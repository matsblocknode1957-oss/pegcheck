import { NextResponse } from "next/server";
import { fetchChainlinkPoR } from "@/lib/chainlinkPoR";

const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";

  const contract = POR_FEEDS[slug];
  if (!contract) return NextResponse.json({ chainlink_por: null });

  const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
  const por = await fetchChainlinkPoR(contract, rpcUrl);
  return NextResponse.json({ chainlink_por: por });
}
