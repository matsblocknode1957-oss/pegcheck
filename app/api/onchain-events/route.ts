import { NextResponse } from "next/server";

export const revalidate = 60;

const CONTRACT_ADDRESS = "0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa";
const ABI = ["function getDepegEvents() external view returns (tuple(string symbol, uint256 price, uint256 timestamp, string severity)[])"];
const SEPOLIA_FALLBACK = "https://ethereum-sepolia-rpc.publicnode.com";

export async function GET() {
  const primaryRpcUrl = process.env.SEPOLIA_RPC_URL ?? "";
  const urls = primaryRpcUrl ? [primaryRpcUrl, SEPOLIA_FALLBACK] : [SEPOLIA_FALLBACK];

  for (const url of urls) {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider(url);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const raw = await contract.getDepegEvents();
      const events = ([...raw] as { symbol: string; price: bigint; timestamp: bigint; severity: string }[])
        .reverse()
        .map((ev) => ({
          symbol: ev.symbol,
          price: ev.price.toString(),
          timestamp: ev.timestamp.toString(),
          severity: ev.severity,
        }));
      return NextResponse.json({ events }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      });
    } catch (e: unknown) {
      console.warn("onchain-events RPC failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({ events: [] }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
