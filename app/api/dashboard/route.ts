import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TIER_LIMITS: Record<string, number | null> = {
  starter: 10000,
  pro: 100000,
  enterprise: null,
};

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("api_keys")
    .select("key, tier, active, calls_this_month, created_at")
    .eq("email", email.toLowerCase().trim())
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Dashboard lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ found: false });
  }

  const limit = TIER_LIMITS[data.tier] ?? null;
  const used = data.calls_this_month ?? 0;

  return NextResponse.json({
    found: true,
    key: data.key,
    tier: data.tier,
    calls_used: used,
    calls_limit: limit,
    calls_remaining: limit !== null ? Math.max(0, limit - used) : null,
    created_at: data.created_at,
  });
}
