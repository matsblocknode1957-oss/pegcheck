import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLUGS = ["usdt","usdc","usds","ethena","pyusd","fdusd","rlusd","tusd"];

export async function GET() {
  try {
    const coins = await Promise.all(
      SLUGS.map(async (slug) => {
        const { data, error } = await supabase
          .from("price_history")
          .select("slug, price, created_at")
          .eq("slug", slug)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) return null;

        const price = Number(data.price);
        const deviation = ((price - 1) * 100);
        const status =
          Math.abs(deviation) >= 3 ? "depegged" :
          Math.abs(deviation) >= 1 ? "warning" : "stable";

        return {
          slug: data.slug,
          price,
          deviation: parseFloat(deviation.toFixed(4)),
          status,
          updated_at: data.created_at,
        };
      })
    );

    return NextResponse.json({
      coins: coins.filter(Boolean),
      total: coins.filter(Boolean).length,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch coins" },
      { status: 500 }
    );
  }
}