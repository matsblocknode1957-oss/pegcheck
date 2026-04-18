import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { data, error } = await supabase
      .from("price_history")
      .select("slug, price, created_at")
      .eq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Coin not found" },
        { status: 404 }
      );
    }

    const row = data[0];
    const price = Number(row.price);
    const deviation = ((price - 1) * 100);
    const status =
      Math.abs(deviation) >= 3 ? "depegged" :
      Math.abs(deviation) >= 1 ? "warning" : "stable";

    return NextResponse.json({
      slug: row.slug,
      price,
      deviation: parseFloat(deviation.toFixed(4)),
      status,
      updated_at: row.created_at,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch coin" },
      { status: 500 }
    );
  }
}