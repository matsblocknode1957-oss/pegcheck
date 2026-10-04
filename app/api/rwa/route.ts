import { NextResponse } from "next/server";
import { fetchRwaAssets } from "@/lib/rwa";

export const dynamic = "force-dynamic";

export async function GET() {
  const assets = await fetchRwaAssets();
  return NextResponse.json(
    { assets, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
  );
}
