import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEurUsd } from "@/lib/fetchEurUsd";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COINGECKO_IDS: Record<string, string> = {
  usdt:   "tether",
  usdc:   "usd-coin",
  dai:    "dai",
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

// CoinMarketCap IDs — used as an optional third source when CMC_API_KEY is set
const CMC_IDS: Record<string, number> = {
  usdt:   825,
  usdc:   3408,
  dai:    4943,
  usds:   4943,
  ethena: 29470,
  pyusd:  27772,
  fdusd:  26081,
  rlusd:  35394,
  tusd:   2563,
  frax:   6952,
  gho:    23508,
  crvusd: 23121,
  lusd:   15024,
  usdp:   3330,
  usdd:   19891,
  eurc:   20641,
  dola:   18153,
  alusd:  9694,
};

function deviationBps(price: number, peg = 1.0): number {
  return Math.round(Math.abs(price - peg) * 10000);
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

  const cmcId = CMC_IDS[slug];
  const cmcApiKey = process.env.CMC_API_KEY;
  const peg = slug === "eurc" ? await fetchEurUsd() : 1.0;

  try {
    const fetches: Promise<unknown>[] = [
      supabase
        .from("price_history")
        .select("price, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .single() as unknown as Promise<unknown>,
      fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
        { next: { revalidate: 60 } }
      ).then((r) => r.json()),
    ];

    if (cmcId && cmcApiKey) {
      fetches.push(
        fetch(
          `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${cmcId}&convert=USD`,
          { headers: { "X-CMC_PRO_API_KEY": cmcApiKey }, next: { revalidate: 60 } }
        ).then((r) => r.json())
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await Promise.allSettled(fetches) as PromiseSettledResult<any>[];
    const [supabaseResult, cgResult, cmcResult] = results;

    let pegcheckSource: { price: number; deviation_bps: number; source: string } | null = null;
    if (supabaseResult.status === "fulfilled" && !supabaseResult.value.error && supabaseResult.value.data) {
      const price = Number(supabaseResult.value.data.price);
      pegcheckSource = { price, deviation_bps: deviationBps(price, peg), source: "Chainlink" };
    }

    let coingeckoSource: { price: number; deviation_bps: number; source: string } | null = null;
    if (cgResult.status === "fulfilled" && cgResult.value?.[cgId]?.usd != null) {
      const price = Number(cgResult.value[cgId].usd);
      coingeckoSource = { price, deviation_bps: deviationBps(price, peg), source: "CoinGecko" };
    }

    let cmcSource: { price: number; deviation_bps: number; source: string } | null = null;
    if (cmcResult?.status === "fulfilled" && cmcId) {
      const cmcPrice = cmcResult.value?.data?.[String(cmcId)]?.quote?.USD?.price;
      if (cmcPrice != null) {
        const price = Number(cmcPrice);
        cmcSource = { price, deviation_bps: deviationBps(price, peg), source: "CoinMarketCap" };
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
    const consensusDeviationBps = deviationBps(consensusPrice, peg);
    const sourcesConfirmed = availablePrices.length;

    // HIGH only when ≥2 sources are present and all prices agree within 10 bps of consensus
    const maxDiffBps = availablePrices.length >= 2
      ? Math.max(...availablePrices.map((p) => Math.round(Math.abs(p - consensusPrice) * 10000)))
      : null;
    const confidence = sourcesConfirmed >= 2 && maxDiffBps! <= 10 ? "HIGH" : "LOW";

    const sources: Record<string, { price: number; deviation_bps: number; source: string }> = {};
    if (pegcheckSource) sources.pegcheck = pegcheckSource;
    if (coingeckoSource) sources.coingecko = coingeckoSource;
    if (cmcSource) sources.coinmarketcap = cmcSource;

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
