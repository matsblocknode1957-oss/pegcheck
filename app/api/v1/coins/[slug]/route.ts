import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Chainlink Proof of Reserve feed contracts (Ethereum Mainnet, 8 decimals)
const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

async function fetchChainlinkPoR(
  contract: string,
  rpcUrl: string
): Promise<{ reserves: number; updated_at: string } | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: contract, data: "0xfeaf968c" }, "latest"],
        id: 1,
      }),
    });
    const json = await res.json();
    if (!json.result || json.result === "0x") return null;
    const hex = json.result.slice(2);
    // ABI slot 1 — int256 answer (reserves, 8 decimals)
    const reserves = Number(BigInt("0x" + hex.slice(64, 128))) / 1e8;
    // ABI slot 3 — uint256 updatedAt
    const updatedAt = Number(BigInt("0x" + hex.slice(192, 256)));
    return { reserves, updated_at: new Date(updatedAt * 1000).toISOString() };
  } catch {
    return null;
  }
}

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
    const deviation = ((price - 1) * 100);
    const status =
      Math.abs(deviation) >= 3 ? "depegged" :
      Math.abs(deviation) >= 1 ? "warning" : "stable";

    return NextResponse.json({
      slug: row.slug,
      price,
      deviation: parseFloat(deviation.toFixed(4)),
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
