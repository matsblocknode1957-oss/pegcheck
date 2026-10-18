import { SupabaseClient } from "@supabase/supabase-js";
import { decide, checkExit, shouldRecord, Evidence, ExitResult } from "./rules";
import {
  RULES_VERSION,
  DIP_ZONE_START_PCT,
  DEEP_DEPEG_PCT,
  LIVES_BELOW_PEG_THRESHOLD,
  getCoinTier,
  SOURCE_DISAGREE_SPREAD_PCT,
  MAX_TRADE_DAYS,
  STOP_LOSS_PCT,
  tunables,
} from "./config";
import { computeMedian, computeHadPriorDipCycle } from "./history";

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
      .select("id, coin, peg, entry_price, size_usd, decided_at, rules_version")
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

        // Source-agreement guard — conservative exits when sources contradict (v3.2)
        const exitSources = sourcePrices[trade.coin] ?? {};
        const exitSourceVals = Object.entries(exitSources)
          .filter(([, v]) => v > 0)
          .map(([, v]) => v);
        const exitSourceCount = exitSourceVals.length;
        const exitSpread = exitSourceCount >= 2
          ? (Math.max(...exitSourceVals) - Math.min(...exitSourceVals)) / Math.min(...exitSourceVals)
          : 0;
        const exitSourcesAgree = exitSourceCount >= 2 && exitSpread < SOURCE_DISAGREE_SPREAD_PCT;
        const ageMs = now.getTime() - new Date(trade.decided_at).getTime();
        const maxMs = MAX_TRADE_DAYS * 24 * 60 * 60 * 1000;
        const lowestSourcePrice = exitSourceVals.length > 0 ? Math.min(...exitSourceVals) : currentPrice;

        if (exitSourceCount <= 1) {
          // Single source — never exit on price; MAX_TRADE_DAYS still applies
          if (ageMs >= maxMs) {
            const units = trade.size_usd / trade.entry_price;
            const forcedExit: ExitResult = {
              status: "timed_out",
              exitPrice: lowestSourcePrice,
              profitUsd: units * lowestSourcePrice - trade.size_usd,
            };
            const { error: singleTimeoutErr } = await supabase
              .from("agent_trades")
              .update({
                status: forcedExit.status,
                closed_at: now.toISOString(),
                exit_price: forcedExit.exitPrice,
                pnl_usd: forcedExit.profitUsd,
              })
              .eq("id", trade.id);
            if (singleTimeoutErr) {
              console.error(`Failed to force-close trade ${trade.id}:`, singleTimeoutErr);
              openCoinSlugs.add(trade.coin);
            } else {
              closed++;
            }
            continue;
          }
          const srcName = Object.entries(exitSources).find(([, v]) => v > 0)?.[0] ?? "unknown";
          console.log(
            `${trade.coin} exit skipped: only 1 source (${srcName} $${lowestSourcePrice.toFixed(4)}), can't cross-check, holding`
          );
          openCoinSlugs.add(trade.coin);
          continue;
        }

        if (!exitSourcesAgree) {
          // 2+ sources disagree — conservative exits only, priced at the lowest source
          const highestSourcePrice = Math.max(...exitSourceVals);
          const stopLossPrice = trade.entry_price * (1 - STOP_LOSS_PCT);
          const takeProfitPrice = trade.peg * (1 - tunables.TAKE_PROFIT_DISTANCE_PCT);

          // MAX_TRADE_DAYS always applies, priced at lowest source
          if (ageMs >= maxMs) {
            const units = trade.size_usd / trade.entry_price;
            const forcedExit: ExitResult = {
              status: "timed_out",
              exitPrice: lowestSourcePrice,
              profitUsd: units * lowestSourcePrice - trade.size_usd,
            };
            const { error: disagreeTimeoutErr } = await supabase
              .from("agent_trades")
              .update({
                status: forcedExit.status,
                closed_at: now.toISOString(),
                exit_price: forcedExit.exitPrice,
                pnl_usd: forcedExit.profitUsd,
              })
              .eq("id", trade.id);
            if (disagreeTimeoutErr) {
              console.error(`Failed to force-close trade ${trade.id}:`, disagreeTimeoutErr);
              openCoinSlugs.add(trade.coin);
            } else {
              closed++;
            }
            continue;
          }

          // Stop-loss: only if even the highest source is below the stop price
          if (highestSourcePrice <= stopLossPrice) {
            const units = trade.size_usd / trade.entry_price;
            const forcedExit: ExitResult = {
              status: "lost",
              exitPrice: lowestSourcePrice,
              profitUsd: units * lowestSourcePrice - trade.size_usd,
            };
            const { error: stopErr } = await supabase
              .from("agent_trades")
              .update({
                status: forcedExit.status,
                closed_at: now.toISOString(),
                exit_price: forcedExit.exitPrice,
                pnl_usd: forcedExit.profitUsd,
              })
              .eq("id", trade.id);
            if (stopErr) {
              console.error(`Failed to close trade ${trade.id}:`, stopErr);
              openCoinSlugs.add(trade.coin);
            } else {
              closed++;
            }
            continue;
          }

          // Take-profit: only if even the lowest source has reached the target
          if (lowestSourcePrice >= takeProfitPrice) {
            const units = trade.size_usd / trade.entry_price;
            const forcedExit: ExitResult = {
              status: "won",
              exitPrice: lowestSourcePrice,
              profitUsd: units * lowestSourcePrice - trade.size_usd,
            };
            const { error: tpErr } = await supabase
              .from("agent_trades")
              .update({
                status: forcedExit.status,
                closed_at: now.toISOString(),
                exit_price: forcedExit.exitPrice,
                pnl_usd: forcedExit.profitUsd,
              })
              .eq("id", trade.id);
            if (tpErr) {
              console.error(`Failed to close trade ${trade.id}:`, tpErr);
              openCoinSlugs.add(trade.coin);
            } else {
              closed++;
            }
            continue;
          }

          // Stale exit (v3+): conservative — only if lowest source is sufficiently in profit
          const majorVer = trade.rules_version
            ? parseInt(trade.rules_version.replace(/^v/i, ""), 10)
            : NaN;
          if (!isNaN(majorVer) && majorVer >= 3) {
            const hoursOpen = ageMs / 3_600_000;
            if (
              hoursOpen >= tunables.STALE_EXIT_HOURS &&
              lowestSourcePrice >= trade.entry_price * (1 + tunables.STALE_EXIT_MIN_PROFIT_PCT)
            ) {
              const units = trade.size_usd / trade.entry_price;
              const forcedExit: ExitResult = {
                status: "stale_exit",
                exitPrice: lowestSourcePrice,
                profitUsd: units * lowestSourcePrice - trade.size_usd,
              };
              const { error: staleErr } = await supabase
                .from("agent_trades")
                .update({
                  status: forcedExit.status,
                  closed_at: now.toISOString(),
                  exit_price: forcedExit.exitPrice,
                  pnl_usd: forcedExit.profitUsd,
                })
                .eq("id", trade.id);
              if (staleErr) {
                console.error(`Failed to close trade ${trade.id}:`, staleErr);
                openCoinSlugs.add(trade.coin);
              } else {
                closed++;
              }
              continue;
            }
          }

          const srcSummary = Object.entries(exitSources)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k} $${(v as number).toFixed(4)}`)
            .join(" / ");
          console.log(
            `${trade.coin} exit skipped: sources disagree (spread ${(exitSpread * 100).toFixed(1)}%, ${srcSummary}), holding`
          );
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
            rulesVersion: trade.rules_version ?? undefined,
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

      // v3: record tier on all evaluated decisions
      evidence.tier = getCoinTier(slug);

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
              // v3: populated below by price_history query (dip-zone only)
              hadPriorDipCycle: null,
              medianPrice7d: null,
            };
          }
        }
      } catch (histErr) {
        console.error(`Failed to fetch history for ${slug}:`, histErr);
      }

      // v3: extra price_history query — only for coins currently in the dip zone
      // (where a buy is actually possible). Kept out of deep-depeg coins to save DB load.
      const currentDepegPct = (peg - price) / peg;
      const isInDipZoneNow =
        currentDepegPct >= DIP_ZONE_START_PCT && currentDepegPct <= DEEP_DEPEG_PCT;

      if (isInDipZoneNow && evidence.history) {
        // Supabase returns max 1,000 rows per request. At a 5-min cron cadence,
        // 7 days = 2,016 rows, so we page through until we have the full window.
        try {
          const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          type PhRow = { created_at: string; price: number };
          const PH_PAGE = 1000;
          const PH_MAX  = 12000; // hard cap — 7-day window is ~5,245 rows at current cadence
          const allRows: PhRow[] = [];
          let phFailed = false;
          let from = 0;

          while (allRows.length < PH_MAX) {
            const { data: page, error: pageError } = await supabase
              .from("price_history")
              .select("created_at, price")
              .eq("slug", slug)
              .gte("created_at", since7d)
              .order("created_at", { ascending: true })
              .range(from, from + PH_PAGE - 1);

            if (pageError || !page) {
              console.error(
                `v3 price history page error for ${slug}:`,
                pageError?.message ?? "null response",
              );
              phFailed = true;
              break;
            }
            allRows.push(...page);
            if (page.length < PH_PAGE) break; // last page
            from += PH_PAGE;
          }

          // Cap hit means oldest-first paging cut off the newest rows — never compute on partial data.
          if (allRows.length >= PH_MAX) {
            console.error(
              `v3 price history cap hit for ${slug}: ${allRows.length} rows >= PH_MAX ${PH_MAX} — data is cut off, treating as unavailable`,
            );
            phFailed = true;
          }

          if (phFailed || allRows.length === 0) {
            console.error(
              `v3 price history unavailable for ${slug}:`,
              phFailed ? "query error or cap hit" : "no rows returned",
            );
            // hadPriorDipCycle and medianPrice7d stay null → decide() blocks the buy
          } else {
            // Freshness check: if the newest row is > 30 min old the cron may have stalled.
            const newestTs = Math.max(...allRows.map(r => Date.parse(r.created_at)));
            const ageMinutes = (now.getTime() - newestTs) / 60_000;
            console.log(
              `v3 price history for ${slug}: ${allRows.length} rows, newest ${new Date(newestTs).toISOString()} (${ageMinutes.toFixed(1)} min ago)`,
            );
            if (ageMinutes > 30) {
              console.error(
                `v3 price history stale for ${slug}: newest row is ${ageMinutes.toFixed(1)} min old (> 30 min threshold), treating as unavailable`,
              );
              // hadPriorDipCycle and medianPrice7d stay null → decide() blocks the buy
            } else {
              // Coerce and drop any non-finite prices before computing
              const validRows = allRows
                .map(r => ({ created_at: r.created_at, price: Number(r.price) }))
                .filter(r => isFinite(r.price));

              if (validRows.length === 0) {
                console.error(`v3 price history for ${slug}: no finite prices after coercion`);
                // hadPriorDipCycle and medianPrice7d stay null → decide() blocks the buy
              } else {
                evidence.history.medianPrice7d = computeMedian(validRows.map(r => r.price));
                evidence.history.hadPriorDipCycle = computeHadPriorDipCycle(
                  validRows, now.getTime(), peg,
                );
              }
            }
          }
        } catch (phErr) {
          console.error(`v3 price history query failed for ${slug}:`, phErr);
          // hadPriorDipCycle and medianPrice7d stay null → decide() blocks the buy
        }

        // Top-level evidence fields for storage in the evidence JSON column
        evidence.livesBelowPeg =
          evidence.history.medianPrice7d !== null &&
          evidence.history.medianPrice7d / peg < LIVES_BELOW_PEG_THRESHOLD;
        evidence.livesBelowPegMedian = evidence.history.medianPrice7d ?? undefined;
        evidence.isRepeatDip = evidence.history.hadPriorDipCycle === true;
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
