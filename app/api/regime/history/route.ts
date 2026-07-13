import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classify } from "@/lib/regime/classifier";
import { COIN_PEGS } from "@/lib/coinPegs";
import type { PricePoint } from "@/lib/regime/types";

function parseDays(range: string): number {
  const m = range.match(/^(\d+)d$/i);
  const n = m ? parseInt(m[1]) : 7;
  return Math.min(90, Math.max(1, n)); // cap at 90d
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") ?? "7d";

  if (!symbol) return NextResponse.json({ error: "Missing ?symbol=" }, { status: 400 });

  const slug = symbol.toLowerCase();
  if (!(slug in COIN_PEGS)) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol.toUpperCase()}` }, { status: 400 });
  }

  try {
  const days = parseDays(range);
  const peg = COIN_PEGS[slug];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Extra 2 days pre-loaded so the 48h window is warm from the start of the requested range
  const since = new Date(Date.now() - (days + 2) * 24 * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("price_history")
    .select("created_at, price, deviation_bps")
    .eq("slug", slug)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length < 5) return NextResponse.json({ symbol: symbol.toUpperCase(), slug, range, classifications: {} });

  const records: PricePoint[] = data.map(r => ({
    created_at: r.created_at,
    deviation_bps: r.deviation_bps != null
      ? r.deviation_bps
      : Math.round((r.price - peg) / peg * 10_000),
  }));

  const windowMs = 48 * 3_600_000;
  const rangeStartMs = Date.now() - days * 24 * 3_600_000;

  // Sample ~6h intervals to keep response size reasonable
  const SAMPLE_MS = 6 * 3_600_000;
  const classifications = [];
  let windowStart = 0;
  let lastSampleMs = 0;

  for (let i = 1; i < records.length; i++) {
    const nowMs = new Date(records[i].created_at).getTime();

    while (windowStart < i && nowMs - new Date(records[windowStart].created_at).getTime() > windowMs) {
      windowStart++;
    }

    if (nowMs < rangeStartMs) continue;
    if (nowMs - lastSampleMs < SAMPLE_MS && i < records.length - 1) continue;

    lastSampleMs = nowMs;
    const cls = classify(records.slice(windowStart, i + 1), slug, records[i].created_at);
    classifications.push({
      timestamp: cls.timestamp,
      layer_a: cls.layer_a,
      layer_b: cls.layer_b,
      confidence: cls.confidence,
      current_severity_bps: cls.features.current_severity,
    });
  }

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    slug,
    range,
    classifications: Object.fromEntries(classifications.map((c, i) => [String(i), c])),
  });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch regime history" }, { status: 500 });
  }
}
