import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const days = parseInt(searchParams.get("days") ?? "7");

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("price_history")
      .select("created_at, price")
      .eq("slug", slug)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: data ?? [] });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}