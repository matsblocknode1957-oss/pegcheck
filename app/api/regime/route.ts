import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classify } from "@/lib/regime/classifier";
import { COIN_PEGS } from "@/lib/coinPegs";
import type { PricePoint } from "@/lib/regime/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Missing ?symbol=" }, { status: 400 });

  const slug = symbol.toLowerCase();
  if (!(slug in COIN_PEGS)) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol.toUpperCase()}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch 49h so the 48h window is fully populated at the boundary
  const since = new Date(Date.now() - 49 * 3_600_000).toISOString();
  const peg = COIN_PEGS[slug];

  const { data, error } = await supabase
    .from("price_history")
    .select("created_at, price, deviation_bps")
    .eq("slug", slug)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length < 2) {
    return NextResponse.json({ error: "Insufficient price history" }, { status: 503 });
  }

  const records: PricePoint[] = data.map(r => ({
    created_at: r.created_at,
    deviation_bps: r.deviation_bps != null
      ? r.deviation_bps
      : Math.round((r.price - peg) / peg * 10_000),
  }));

  const result = classify(records, slug);

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    slug,
    layer_a: result.layer_a,
    layer_b: result.layer_b,
    confidence: result.confidence,
    timestamp: result.timestamp,
    features: result.features,
  });
}
