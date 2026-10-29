import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEurUsd } from "@/lib/fetchEurUsd";
import { COINGECKO_IDS } from "@/lib/coingeckoIds";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


function deviationBps(price: number, peg = 1.0): number {
  return Math.round(Math.abs(price - peg) * 10000);
}

function signal(bps: number): string {
  if (bps < 20) return "STABLE";
  if (bps < 50) return "WATCH";
  if (bps < 100) return "ELEVATED";
  return "CRITICAL";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin");

  if (!coin) {
    return NextResponse.json(
      { error: "Missing required query parameter: coin" },
      { status: 400 }
    );
  }

  const slug = coin.toLowerCase();
  const cgId = COINGECKO_IDS[slug];

  if (!cgId) {
    return NextResponse.json(
      { error: `Unsupported coin: ${coin.toUpperCase()}` },
      { status: 400 }
    );
  }

  const peg = slug === "eurc" ? await fetchEurUsd() : 1.0;

  try {
    const fetches: Promise<unknown>[] = [
      supabase
        .from("price_history")
        .select("price, source_prices, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .single() as unknown as Promise<unknown>,
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await Promise.allSettled(fetches) as PromiseSettledResult<any>[];
    const [supabaseResult] = results;

    let pegcheckSource: { price: number; deviation_bps: number | null; source: string } | null = null;
    if (supabaseResult.status === "fulfilled" && !supabaseResult.value.error && supabaseResult.value.data) {
      const price = Number(supabaseResult.value.data.price);
      pegcheckSource = { price, deviation_bps: peg !== null ? deviationBps(price, peg) : null, source: "Chainlink" };
    }

    // CoinGecko price is read from the latest cron snapshot (source_prices.coingecko) — no live call
    let coingeckoSource: { price: number; deviation_bps: number | null; source: string } | null = null;
    if (supabaseResult.status === "fulfilled" && !supabaseResult.value.error && supabaseResult.value.data) {
      const cgPrice = supabaseResult.value.data.source_prices?.coingecko;
      if (cgPrice != null && Number(cgPrice) > 0) {
        const price = Number(cgPrice);
        coingeckoSource = { price, deviation_bps: peg !== null ? deviationBps(price, peg) : null, source: "CoinGecko" };
      }
    }

    // CMC price is read from the latest cron snapshot (source_prices.cmc) — no live call
    let cmcSource: { price: number; deviation_bps: number | null; source: string } | null = null;
    if (supabaseResult.status === "fulfilled" && !supabaseResult.value.error && supabaseResult.value.data) {
      const cmcPrice = supabaseResult.value.data.source_prices?.cmc;
      if (cmcPrice != null && Number(cmcPrice) > 0) {
        const price = Number(cmcPrice);
        cmcSource = { price, deviation_bps: peg !== null ? deviationBps(price, peg) : null, source: "CoinMarketCap" };
      }
    }

    if (!pegcheckSource && !coingeckoSource && !cmcSource) {
      return NextResponse.json(
        { error: "No price data available for this coin" },
        { status: 503 }
      );
    }

    const availablePrices = [pegcheckSource?.price, coingeckoSource?.price, cmcSource?.price].filter(
      (p): p is number => p !== undefined
    );
    const consensusPrice = parseFloat(
      (availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length).toFixed(4)
    );
    const consensusDeviationBps = peg !== null ? deviationBps(consensusPrice, peg) : null;
    const sourcesConfirmed = availablePrices.length;

    // HIGH only when ≥2 sources are present and all prices agree within 10 bps of consensus
    const maxDiffBps = availablePrices.length >= 2
      ? Math.max(...availablePrices.map((p) => Math.round(Math.abs(p - consensusPrice) * 10000)))
      : null;
    const confidence = peg === null ? "NONE"
      : sourcesConfirmed >= 2 && maxDiffBps !== null && maxDiffBps <= 10 ? "HIGH" : "LOW";

    const sources: Record<string, { price: number; deviation_bps: number | null; source: string }> = {};
    if (pegcheckSource) sources.pegcheck = pegcheckSource;
    if (coingeckoSource) sources.coingecko = coingeckoSource;
    if (cmcSource) sources.coinmarketcap = cmcSource;

    return NextResponse.json({
      coin: coin.toUpperCase(),
      timestamp: new Date().toISOString(),
      peg,
      sources,
      consensus_price: consensusPrice,
      consensus_deviation_bps: consensusDeviationBps,
      signal: peg !== null && consensusDeviationBps !== null ? signal(consensusDeviationBps) : "UNKNOWN",
      confidence,
      sources_confirmed: sourcesConfirmed,
      pegcheck_url: "https://pegcheck.uk",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch depeg status" },
      { status: 500 }
    );
  }
}
