import { SupabaseClient } from "@supabase/supabase-js";
import { decide, checkExit, shouldRecord, Evidence } from "./rules";
import { RULES_VERSION } from "./config";

interface RunnerParams {
  supabase: SupabaseClient;
  prices: Record<string, number | null>;
  sourcePrices: Record<string, Record<string, number>>;
  pegFor: (slug: string) => number;
  now: Date;
}

interface RunnerResult {
  closed: number;
  recorded: number;
}

export async function runAgent({
  supabase,
  prices,
  sourcePrices,
  pegFor,
  now,
}: RunnerParams): Promise<RunnerResult> {
  let closed = 0;
  let recorded = 0;

  try {
    // Step 1: Close open trades
    const { data: openTrades, error: openTradesError } = await supabase
      .from("agent_trades")
      .select("id, coin, peg, entry_price, size_usd, decided_at")
      .eq("mode", "live")
      .eq("status", "open");

    if (openTradesError) {
      console.error("Failed to load open trades:", openTradesError);
    }

    const openCoinSlugs = new Set<string>();

    if (openTrades) {
      for (const trade of openTrades) {
        const currentPrice = prices[trade.coin];
        if (currentPrice === null || currentPrice === undefined) {
          openCoinSlugs.add(trade.coin);
          continue;
        }

        const exitResult = checkExit(
          {
            coin: trade.coin,
            peg: trade.peg,
            entry: trade.entry_price,
            sizeUsd: trade.size_usd,
            openedAt: new Date(trade.decided_at),
          },
          currentPrice,
          now
        );

        if (exitResult.status !== "open") {
          const { error: updateError } = await supabase
            .from("agent_trades")
            .update({
              status: exitResult.status,
              closed_at: now.toISOString(),
              exit_price: exitResult.exitPrice,
              pnl_usd: exitResult.profitUsd,
            })
            .eq("id", trade.id);

          if (updateError) {
            console.error(`Failed to close trade ${trade.id}:`, updateError);
            openCoinSlugs.add(trade.coin);
          } else {
            closed++;
          }
        } else {
          openCoinSlugs.add(trade.coin);
        }
      }
    }

    // Step 2: Large transfers in last 24h — one query
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: largeTxs, error: largeTxsError } = await supabase
      .from("large_transactions")
      .select("slug, amount")
      .gte("created_at", since24h)
      .gte("amount", 1_000_000);

    if (largeTxsError) {
      console.error("Failed to load large transactions:", largeTxsError);
    }

    const transferCountByCoin: Record<string, number> = {};
    const transferTotalByCoin: Record<string, number> = {};
    if (largeTxs) {
      for (const tx of largeTxs) {
        transferCountByCoin[tx.slug] = (transferCountByCoin[tx.slug] ?? 0) + 1;
        transferTotalByCoin[tx.slug] = (transferTotalByCoin[tx.slug] ?? 0) + tx.amount;
      }
    }

    // Step 4 setup: One query for live trades in last 6h for spam prevention
    const since6h = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentTrades, error: recentTradesError } = await supabase
      .from("agent_trades")
      .select("coin, decision, decided_at")
      .eq("mode", "live")
      .gte("decided_at", since6h)
      .order("decided_at", { ascending: false });

    if (recentTradesError) {
      console.error("Failed to load recent trades:", recentTradesError);
    }

    const recentDecisionByCoin: Record<string, string> = {};
    if (recentTrades) {
      for (const t of recentTrades) {
        if (!(t.coin in recentDecisionByCoin)) {
          recentDecisionByCoin[t.coin] = t.decision;
        }
      }
    }

    // Open position count after step 1; incremented each time a buy is inserted
    let openPositionsCount = openCoinSlugs.size;

    // Steps 3 & 5: Evaluate and record decisions for each coin with a price
    for (const [slug, price] of Object.entries(prices)) {
      if (price === null || price === undefined) continue;

      const peg = pegFor(slug);
      const sources = sourcePrices[slug] ?? {};
      const pricesBySource: Record<string, number> = Object.fromEntries(
        Object.entries(sources).filter(([, v]) => v > 0)
      );

      const evidence: Evidence = {
        coin: slug,
        peg,
        medianPrice: price,
        pricesBySource,
        largeTransferCount24h: transferCountByCoin[slug] ?? 0,
        largeTransferTotalUsd24h: transferTotalByCoin[slug] ?? 0,
        openPositionsCount,
      };

      if (!shouldRecord(evidence)) continue;

      // Fetch price history for this coin
      try {
        const { data: statsRaw, error: statsError } = await supabase
          .rpc("coin_history_stats", { p_slug: slug });

        if (statsError) {
          console.error(`History RPC error for ${slug}:`, statsError);
        } else if (statsRaw) {
          const s = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;
          if (s) {
            const lastAtPeg = s.last_at_peg ? new Date(s.last_at_peg) : null;
            const firstSeen = s.first_seen ? new Date(s.first_seen) : null;

            let hoursOffPeg: number | null = null;
            if (lastAtPeg) {
              hoursOffPeg = (now.getTime() - lastAtPeg.getTime()) / (1000 * 60 * 60);
            } else if (firstSeen) {
              hoursOffPeg = (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60);
            }

            const p1h = s.price_1h_ago != null ? Number(s.price_1h_ago) : null;
            const p24h = s.price_24h_ago != null ? Number(s.price_24h_ago) : null;
            const low24h = s.low_24h != null ? Number(s.low_24h) : null;

            evidence.history = {
              hoursOffPeg,
              change1hPct: p1h ? (price - p1h) / p1h : null,
              change24hPct: p24h ? (price - p24h) / p24h : null,
              bounceFromLowPct: low24h ? (price - low24h) / low24h : null,
              pctBelow7d: s.pct_below_7d != null ? Number(s.pct_below_7d) : null,
              daysOfData: firstSeen
                ? (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
                : null,
            };
          }
        }
      } catch (histErr) {
        console.error(`Failed to fetch history for ${slug}:`, histErr);
      }

      const result = decide(evidence);
      const { decision, danger, opportunity } = result;

      // Step 4: skip if same decision was already recorded in the last 6h
      const lastDecision = recentDecisionByCoin[slug];
      if (lastDecision !== undefined && lastDecision === decision) continue;

      // Never open a second buy for a coin that already has an open trade
      if (decision === "buy" && openCoinSlugs.has(slug)) continue;

      const row: Record<string, unknown> = {
        mode: "live",
        decided_at: now.toISOString(),
        coin: slug,
        chain: "Ethereum",
        peg,
        price,
        decision,
        danger_score: danger.score,
        opportunity_score: opportunity.score,
        danger_reasons: danger.reasons,
        opportunity_reasons: opportunity.reasons,
        evidence,
        rules_version: RULES_VERSION,
        summary: "",
        status: decision === "buy" ? "open" : "none",
      };

      if (decision === "buy" && result.buy) {
        row.size_usd = result.buy.sizeUsd;
        row.entry_price = result.buy.entry;
        row.target_price = result.buy.takeProfit;
        row.stop_price = result.buy.stopLoss;
      }

      const { error: insertError } = await supabase
        .from("agent_trades")
        .insert(row);

      if (insertError) {
        console.error(`Failed to insert trade for ${slug}:`, insertError);
      } else {
        recorded++;
        if (decision === "buy") {
          openCoinSlugs.add(slug);
          openPositionsCount++;
        }
      }
    }
  } catch (e) {
    console.error("runAgent failed:", e);
  }

  return { closed, recorded };
}
