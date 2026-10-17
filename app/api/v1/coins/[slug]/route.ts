import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";
import { fetchEurUsd } from "@/lib/fetchEurUsd";
import { fetchChainlinkPoR } from "@/lib/chainlinkPoR";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Chainlink Proof of Reserve feed contracts (Ethereum Mainnet)
const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    // Fetch price and PoR data in parallel
    const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
    const porContract = POR_FEEDS[slug];

    const [priceResult, porData] = await Promise.all([
      supabase
        .from("price_history")
        .select("slug, price, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1),
      porContract && rpcUrl
        ? fetchChainlinkPoR(porContract, rpcUrl)
        : Promise.resolve(null),
    ]);

    const { data, error } = priceResult;

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Coin not found" },
        { status: 404 }
      );
    }

    const row = data[0];
    const price = Number(row.price);
    const peg = slug === "eurc" ? await fetchEurUsd() : (COIN_PEGS[slug] ?? 1.0);
    const { healthy, caution } = getThresholds(slug);
    let deviation: number | null = null;
    let status = "unknown";
    if (peg !== null) {
      const rawDeviation = ((price - peg) / peg) * 100;
      const absDeviation = Math.abs(rawDeviation);
      deviation = parseFloat(rawDeviation.toFixed(4));
      status = absDeviation >= caution * 100 ? "depegged"
        : absDeviation >= healthy * 100 ? "warning" : "stable";
    }

    return NextResponse.json({
      slug: row.slug,
      price,
      peg,
      deviation,
      status,
      updated_at: row.created_at,
      chainlink_por: porData,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch coin" },
      { status: 500 }
    );
  }
}
