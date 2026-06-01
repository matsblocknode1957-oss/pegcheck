import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const revalidate = 0;

const CONTRACT = "0x44930ef915b30CbA75C0B94d62cE516d7900d27C";

// Filter specifically for CCIPAlertSent events — only real cross-chain dispatches
const CCIP_ALERT_TOPIC = ethers.id("CCIPAlertSent(bytes32,uint64,string,uint8)");

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
    // Scan from latest - 200000 blocks (~1 month). The contract is newly deployed
    // so all events fall within this window. Avoids a full chain scan.
    const blockResult = await rpc(rpcUrl, "eth_blockNumber", []);
    const latestBlock = Number(BigInt(blockResult.result ?? "0x0"));
    const fromBlock   = "0x" + Math.max(0, latestBlock - 200000).toString(16);

    let ccipCount = 0;
    try {
      const logsResult = await rpc(rpcUrl, "eth_getLogs", [{
        address:   CONTRACT,
        topics:    [CCIP_ALERT_TOPIC],
        fromBlock,
        toBlock:   "latest",
      }]);
      if (Array.isArray(logsResult.result)) ccipCount = logsResult.result.length;
    } catch {}

    return NextResponse.json({ ccipCount });
  } catch {
    return NextResponse.json({ error: "Failed to query contract" }, { status: 500 });
  }
}
