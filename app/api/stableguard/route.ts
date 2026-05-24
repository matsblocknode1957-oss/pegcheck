import { NextResponse } from "next/server";

export const revalidate = 0;

const CONTRACT = "0xc30093c695bb9e757170fe568f6248e7c13eef8f";

async function rpc(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    cache: "no-store",
  });
  return res.json();
}

export async function GET() {
  const rpcUrl = process.env.ALCHEMY_SEPOLIA_RPC_URL ?? "";
  if (!rpcUrl) return NextResponse.json({ error: "RPC not configured" }, { status: 500 });

  try {
    const { ethers } = await import("ethers");

    // Read confidence score — try confidenceScore() then getConfidenceScore()
    let confidenceScore: number | null = null;
    for (const sig of ["confidenceScore()", "getConfidenceScore()"]) {
      try {
        const selector = ethers.id(sig).slice(0, 10);
        const result = await rpc(rpcUrl, "eth_call", [{ to: CONTRACT, data: selector }, "latest"]);
        if (result.result && result.result !== "0x" && result.result.length >= 66) {
          const val = Number(BigInt(result.result));
          if (val >= 0 && val <= 10) { confidenceScore = val; break; }
        }
      } catch {}
    }

    // Get all logs from contract (all events, no topic filter)
    let logs: { blockNumber: string; transactionHash: string; topics: string[] }[] = [];
    try {
      const logsResult = await rpc(rpcUrl, "eth_getLogs", [{
        address: CONTRACT,
        fromBlock: "0x0",
        toBlock: "latest",
      }]);
      if (Array.isArray(logsResult.result)) logs = logsResult.result;
    } catch {}

    // Fetch block timestamps for the 5 most recent events
    const recentRaw = [...logs].reverse().slice(0, 5);
    const recentEvents = await Promise.all(
      recentRaw.map(async (log) => {
        let timestamp: number | null = null;
        try {
          const b = await rpc(rpcUrl, "eth_getBlockByNumber", [log.blockNumber, false]);
          if (b.result?.timestamp) timestamp = Number(BigInt(b.result.timestamp));
        } catch {}
        return {
          blockNumber: Number(BigInt(log.blockNumber)),
          txHash: log.transactionHash as string,
          timestamp,
        };
      })
    );

    return NextResponse.json({ confidenceScore, totalEvents: logs.length, recentEvents });
  } catch {
    return NextResponse.json({ error: "Failed to query contract" }, { status: 500 });
  }
}
