import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COINGECKO_IDS: Record<string, string> = {
  usdt:   "tether",
  usdc:   "usd-coin",
  usds:   "dai",
  ethena: "ethena-usde",
  pyusd:  "paypal-usd",
  fdusd:  "first-digital-usd",
  rlusd:  "ripple-usd",
  tusd:   "true-usd",
  frax:   "frax",
  gho:    "gho",
  crvusd: "crvusd",
  lusd:   "liquity-usd",
  usdp:   "paxos-standard",
  usdd:   "usdd",
  mkusd:  "prisma-mkusd",
  eurc:   "euro-coin",
  dola:   "dola-usd",
  alusd:  "alchemix-usd",
  bold:   "bold",
};

function deviationBps(price: number): number {
  return Math.round(Math.abs(price - 1.0) * 10000);
}

function signal(bps: number): string {
  if (bps < 20) return "STABLE";
  if (bps < 50) return "WATCH";
  if (bps < 100) return "HEDGE";
  return "EXIT";
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

  try {
    const [supabaseResult, cgResult] = await Promise.allSettled([
      supabase
        .from("price_history")
        .select("price, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
        { next: { revalidate: 60 } }
      ).then((r) => r.json()),
    ]);

    let pegcheckSource: { price: number; deviation_bps: number; source: string } | null = null;
    if (
      supabaseResult.status === "fulfilled" &&
      !supabaseResult.value.error &&
      supabaseResult.value.data
    ) {
      const price = Number(supabaseResult.value.data.price);
      pegcheckSource = { price, deviation_bps: deviationBps(price), source: "Chainlink" };
    }

    let coingeckoSource: { price: number; deviation_bps: number; source: string } | null = null;
    if (
      cgResult.status === "fulfilled" &&
      cgResult.value?.[cgId]?.usd != null
    ) {
      const price = Number(cgResult.value[cgId].usd);
      coingeckoSource = { price, deviation_bps: deviationBps(price), source: "CoinGecko" };
    }

    if (!pegcheckSource && !coingeckoSource) {
      return NextResponse.json(
        { error: "No price data available for this coin" },
        { status: 503 }
      );
    }

    const availablePrices = [pegcheckSource?.price, coingeckoSource?.price].filter(
      (p): p is number => p !== undefined
    );
    const consensusPrice = parseFloat(
      (availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length).toFixed(4)
    );
    const consensusDeviationBps = deviationBps(consensusPrice);
    const sourcesConfirmed = availablePrices.length;

    // HIGH only when both sources are present and prices agree within 10 bps
    const priceDiffBps =
      pegcheckSource && coingeckoSource
        ? Math.round(Math.abs(pegcheckSource.price - coingeckoSource.price) * 10000)
        : null;
    const confidence = sourcesConfirmed === 2 && priceDiffBps! <= 10 ? "HIGH" : "LOW";

    const sources: Record<string, { price: number; deviation_bps: number; source: string }> = {};
    if (pegcheckSource) sources.pegcheck = pegcheckSource;
    if (coingeckoSource) sources.coingecko = coingeckoSource;

    return NextResponse.json({
      coin: coin.toUpperCase(),
      timestamp: new Date().toISOString(),
      sources,
      consensus_price: consensusPrice,
      consensus_deviation_bps: consensusDeviationBps,
      signal: signal(consensusDeviationBps),
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
