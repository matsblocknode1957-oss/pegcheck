import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";
import { fetchEurUsd } from "@/lib/fetchEurUsd";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const interval = searchParams.get("interval") ?? "24h";

    let query = supabase
      .from("price_history")
      .select("slug, price, created_at")
      .eq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(100);

    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "No history found for this coin" },
        { status: 404 }
      );
    }

    const peg = slug === "eurc" ? await fetchEurUsd() : (COIN_PEGS[slug] ?? 1.0);
    const { healthy, caution } = getThresholds(slug);
    const history = data.map((row) => {
      const price = Number(row.price);
      const deviation = ((price - peg) / peg) * 100;
      const absDeviation = Math.abs(deviation);
      const status =
        absDeviation >= caution * 100 ? "depegged" :
        absDeviation >= healthy * 100 ? "warning" : "stable";

      return {
        timestamp: row.created_at,
        price,
        deviation: parseFloat(deviation.toFixed(4)),
        status,
      };
    });

    const depegEvents = history.filter(h => h.status === "depegged");

    return NextResponse.json({
      slug,
      interval,
      history,
      depeg_events: depegEvents,
      total: history.length,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}