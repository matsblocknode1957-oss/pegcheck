import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

export const revalidate = 3600;

const ALL_SLUGS = [
  "usdt","usdc","dai","usds","ethena","pyusd","fdusd","rlusd","tusd","frax",
  "gho","crvusd","lusd","usdp","usdd","mkusd","eurc","dola","alusd","bold",
  "usdg","usd1","u","usdgo","usdf",
];

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ persistentDepeg: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("price_history")
      .select("slug, max_price:price.max()")
      .gte("created_at", sevenDaysAgo)
      .in("slug", ALL_SLUGS);

    if (error || !data) {
      console.error("persistent-depeg query error:", error?.message);
      return NextResponse.json({ persistentDepeg: [] });
    }

    const persistentDepeg = (data as { slug: string; max_price: number }[])
      .filter(row => {
        if (!row.max_price) return false;
        const peg = COIN_PEGS[row.slug] ?? 1.0;
        const { caution } = getThresholds(row.slug);
        return row.max_price < peg * (1 - caution);
      })
      .map(row => row.slug);

    return NextResponse.json({ persistentDepeg });
  } catch (e) {
    console.error("persistent-depeg error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ persistentDepeg: [] });
  }
}
