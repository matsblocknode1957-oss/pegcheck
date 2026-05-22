import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLUGS = ["usdt","usdc","usds","ethena","pyusd","fdusd","rlusd","tusd","frax","gho","crvusd","lusd","usdp","usdd","mkusd","eurc","dola","alusd","bold"];

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

export async function GET() {
  try {
    // Fetch PoR data in parallel with coin price queries
    const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
    const porResults: Record<string, { reserves: number; updated_at: string } | null> = {};
    if (rpcUrl) {
      await Promise.allSettled(
        Object.entries(POR_FEEDS).map(async ([slug, contract]) => {
          porResults[slug] = await fetchChainlinkPoR(contract, rpcUrl);
        })
      );
    }

    const coins = await Promise.all(
      SLUGS.map(async (slug) => {
        const { data, error } = await supabase
          .from("price_history")
          .select("slug, price, created_at")
          .eq("slug", slug)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) return null;

        const price = Number(data.price);
        const peg = COIN_PEGS[slug] ?? 1.0;
        const deviation = ((price - peg) / peg) * 100;
        const absDeviation = Math.abs(deviation);
        const { healthy, caution } = getThresholds(slug);
        const status =
          absDeviation >= caution * 100 ? "depegged" :
          absDeviation >= healthy * 100 ? "warning" : "stable";

        return {
          slug: data.slug,
          price,
          deviation: parseFloat(deviation.toFixed(4)),
          status,
          updated_at: data.created_at,
          chainlink_por: porResults[slug] ?? null,
        };
      })
    );

    return NextResponse.json({
      coins: coins.filter(Boolean),
      total: coins.filter(Boolean).length,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch coins" },
      { status: 500 }
    );
  }
}
