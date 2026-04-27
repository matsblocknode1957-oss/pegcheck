import { NextResponse } from "next/server";

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
  if (!contract) {
    return NextResponse.json({ chainlink_por: null });
  }

  const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
  if (!rpcUrl) {
    return NextResponse.json({ chainlink_por: null });
  }

  const por = await fetchChainlinkPoR(contract, rpcUrl);
  return NextResponse.json({ chainlink_por: por });
}
