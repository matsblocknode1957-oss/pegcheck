import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classify } from "@/lib/regime/classifier";
import { COIN_PEGS } from "@/lib/coinPegs";
import type { PricePoint } from "@/lib/regime/types";

const ALL_SLUGS = Object.keys(COIN_PEGS);

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since = new Date(Date.now() - 49 * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("price_history")
    .select("created_at, slug, price, deviation_bps")
    .in("slug", ALL_SLUGS)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No data" }, { status: 503 });

  // Group records by slug
  const bySlug: Record<string, PricePoint[]> = {};
  for (const r of data) {
    if (!bySlug[r.slug]) bySlug[r.slug] = [];
    const peg = COIN_PEGS[r.slug] ?? 1.0;
    bySlug[r.slug].push({
      created_at: r.created_at,
      deviation_bps: r.deviation_bps != null
        ? r.deviation_bps
        : Math.round((r.price - peg) / peg * 10_000),
    });
  }

  const coinRegimes = ALL_SLUGS
    .filter(slug => (bySlug[slug]?.length ?? 0) >= 2)
    .map(slug => {
      const cls = classify(bySlug[slug], slug);
      return {
        slug,
        layer_a: cls.layer_a,
        layer_b: cls.layer_b,
        confidence: cls.confidence,
        current_severity_bps: cls.features.current_severity,
      };
    });

  const stressed = coinRegimes.filter(c =>
    c.layer_b === "WOBBLE" || c.layer_b === "SLIDE" || c.layer_b === "BREAK"
  );

  const stress_level =
    stressed.some(c => c.layer_b === "BREAK") ? "CRITICAL" :
    stressed.length >= 3 ? "ELEVATED" :
    stressed.length >= 1 ? "WATCH" :
    "NORMAL";

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    stress_level,
    stressed_coin_count: stressed.length,
    stressed_coins: stressed,
    all_regimes: coinRegimes,
  });
}
