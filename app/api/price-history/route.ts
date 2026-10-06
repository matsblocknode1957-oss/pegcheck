import { NextResponse } from "next/server";

const PAGE_SIZE = 1000;
const MAX_ROWS  = 20_000;
const TARGET    = 1000;

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

    // Fetch all rows in the window in pages of 1,000 (hard cap: 20,000 rows).
    type Row = { created_at: string; price: number };
    const all: Row[] = [];
    let from = 0;

    while (from < MAX_ROWS) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("price_history")
        .select("created_at, price")
        .eq("slug", slug)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const page = data ?? [];
      all.push(...page);

      if (page.length < PAGE_SIZE) break; // last page
      from += PAGE_SIZE;
    }

    // If ≤ TARGET rows, return as-is. Otherwise thin evenly, always keeping
    // the first and last (newest) row.
    let history: Row[];
    if (all.length <= TARGET) {
      history = all;
    } else {
      const step = (all.length - 1) / (TARGET - 1);
      const thinned: Row[] = [];
      for (let i = 0; i < TARGET; i++) {
        thinned.push(all[Math.round(i * step)]);
      }
      // Guarantee the exact last row is included.
      thinned[TARGET - 1] = all[all.length - 1];
      history = thinned;
    }

    return NextResponse.json({ history });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
