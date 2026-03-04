import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? "usdt";

    const { data, error } = await supabase
      .from("large_transactions")
      .select("tx_hash, amount, action, created_at")
      .eq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ transactions: [] });
    return NextResponse.json({ transactions: data });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}
