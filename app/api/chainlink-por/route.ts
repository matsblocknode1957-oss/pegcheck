import { NextResponse } from "next/server";

const MAINNET_FALLBACK = "https://ethereum-rpc.publicnode.com";

const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

async function ethCallWithRetry(contract: string, data: string, primaryUrl: string): Promise<string | null> {
  const urls = primaryUrl ? [primaryUrl, MAINNET_FALLBACK] : [MAINNET_FALLBACK];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
      });
      const json = await res.json();
      if (json.error) {
        console.warn("PoR RPC error:", json.error.message ?? JSON.stringify(json.error));
        continue;
      }
      if (!json.result || json.result === "0x") return null;
      return json.result;
    } catch (e: unknown) {
      console.warn("PoR fetch failed:", e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}

async function fetchChainlinkPoR(
  contract: string,
  rpcUrl: string
): Promise<{ reserves: number; updated_at: string } | null> {
  try {
    // decimals() = 0x313ce567 — read from chain so we never hardcode the wrong value
    const decimalsHex = await ethCallWithRetry(contract, "0x313ce567", rpcUrl);
    const decimals = decimalsHex ? Number(BigInt(decimalsHex)) : 8;

    // latestRoundData() = 0xfeaf968c
    const result = await ethCallWithRetry(contract, "0xfeaf968c", rpcUrl);
    if (!result) return null;

    const hex = result.slice(2);
    // ABI slot 1 — int256 answer (reserves)
    const rawAnswer = BigInt("0x" + hex.slice(64, 128));
    const reserves = Number(rawAnswer) / Math.pow(10, decimals);
    // ABI slot 3 — uint256 updatedAt
    const updatedAt = Number(BigInt("0x" + hex.slice(192, 256)));
    if (reserves <= 0) return null;
    return { reserves, updated_at: new Date(updatedAt * 1000).toISOString() };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";

  const contract = POR_FEEDS[slug];
  if (!contract) return NextResponse.json({ chainlink_por: null });

  const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
  const por = await fetchChainlinkPoR(contract, rpcUrl);
  return NextResponse.json({ chainlink_por: por });
}
