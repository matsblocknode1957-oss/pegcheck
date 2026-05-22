import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLUGS = ["usdt","usdc","usds","ethena","pyusd","fdusd","rlusd","tusd","frax","gho","crvusd","lusd","usdp","usdd","mkusd","eurc","dola","alusd","usdx","bold"];

export async function GET() {
  try {
    const alerts = [];

    for (const slug of SLUGS) {
      const { data, error } = await supabase
        .from("price_history")
        .select("slug, price, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) continue;

      const row = data[0];
      const price = Number(row.price);
      const deviation = ((price - 1) * 100);
      const absDeviation = Math.abs(deviation);

      if (absDeviation >= 1) {
        alerts.push({
          coin: slug.toUpperCase(),
          price,
          deviation: parseFloat(deviation.toFixed(4)),
          severity: absDeviation >= 3 ? "depegged" : "warning",
          triggered_at: row.created_at,
        });
      }
    }

    return NextResponse.json({
      alerts,
      all_stable: alerts.length === 0,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}