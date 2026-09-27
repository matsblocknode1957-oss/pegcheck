import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CONTRACT_ADDRESS = "0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa";
const ABI = ["function getDepegEvents() external view returns (tuple(string symbol, uint256 price, uint256 timestamp, string severity)[])"];
const SEPOLIA_FALLBACK = "https://ethereum-sepolia-rpc.publicnode.com";

export async function GET() {
  const primaryRpcUrl = process.env.SEPOLIA_RPC_URL ?? "";
  const urls = primaryRpcUrl ? [primaryRpcUrl, SEPOLIA_FALLBACK] : [SEPOLIA_FALLBACK];

  const { ethers } = await import("ethers");
  const iface = new ethers.Interface(ABI);
  const calldata = iface.encodeFunctionData("getDepegEvents", []);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: CONTRACT_ADDRESS, data: calldata }, "latest"],
        }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.error) {
        console.warn("onchain-events RPC error:", json.error.message ?? JSON.stringify(json.error));
        continue;
      }
      if (!json.result || json.result === "0x") continue;
      const [rawEvents] = iface.decodeFunctionResult("getDepegEvents", json.result);
      const events = ([...rawEvents] as { symbol: string; price: bigint; timestamp: bigint; severity: string }[])
        .reverse()
        .map((ev) => ({
          symbol: ev.symbol,
          price: ev.price.toString(),
          timestamp: ev.timestamp.toString(),
          severity: ev.severity,
        }));
      return NextResponse.json({ events }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    } catch (e: unknown) {
      console.warn("onchain-events RPC failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({ events: [] }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
