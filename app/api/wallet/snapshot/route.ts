import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("risk_score, total_value, coin_count, created_at")
      .eq("address", address.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ snapshots: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch snapshots" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, riskScore, totalValue, coinCount } = body as {
      address: string;
      riskScore: number;
      totalValue: number;
      coinCount: number;
    };

    if (!address || riskScore == null || totalValue == null || coinCount == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const addr = address.toLowerCase();

    // Check if a snapshot was saved in the last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("portfolio_snapshots")
      .select("created_at")
      .eq("address", addr)
      .gte("created_at", hourAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json({ skipped: true });
    }

    const { error } = await supabase
      .from("portfolio_snapshots")
      .insert({ address: addr, risk_score: riskScore, total_value: totalValue, coin_count: coinCount });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
  }
}
