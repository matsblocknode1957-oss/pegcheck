import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30"), 1), 365);

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("price_history")
    .select("price, created_at")
    .eq("slug", slug)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(15000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bucket raw records into hourly averages to keep response small
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    d.setMinutes(0, 0, 0);
    d.setMilliseconds(0);
    const key = d.toISOString();
    if (!buckets.has(key)) buckets.set(key, { sum: 0, count: 0 });
    const b = buckets.get(key)!;
    b.sum += Number(row.price);
    b.count++;
  }

  const chartData = Array.from(buckets.entries())
    .map(([time, { sum, count }]) => ({ time, price: parseFloat((sum / count).toFixed(6)) }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return NextResponse.json({ data: Object.fromEntries(chartData.map((p, i) => [String(i), p])) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
