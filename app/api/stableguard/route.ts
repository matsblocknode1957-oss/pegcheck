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
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "";
  if (!rpcUrl) return NextResponse.json({ error: "RPC not configured" }, { status: 500 });

  try {
    // Get all logs from contract — no topic filter, all events
    let logs: { blockNumber: string; transactionHash: string }[] = [];
    try {
      const logsResult = await rpc(rpcUrl, "eth_getLogs", [{
        address: CONTRACT,
        fromBlock: "0x" + (10900000).toString(16),
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

    return NextResponse.json({ totalEvents: logs.length, recentEvents });
  } catch {
    return NextResponse.json({ error: "Failed to query contract" }, { status: 500 });
  }
}
