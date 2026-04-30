import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/v1 routes
  if (!pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // Get API key from header
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "").trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Add Authorization: Bearer YOUR_KEY header." },
      { status: 401 }
    );
  }

  // Allow read-only demo key (no DB lookup, no call counting)
  if (apiKey === "pk_live_test123") {
    return NextResponse.next();
  }

  // Check key exists and is active in Supabase
  const { data, error } = await supabase
    .from("api_keys")
    .select("key, tier, active, calls_this_month")
    .eq("key", apiKey)
    .eq("active", true)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Invalid or inactive API key." },
      { status: 401 }
    );
  }

  // Check monthly call limit
  const TIER_LIMITS: Record<string, number | null> = {
    starter: 10000,
    pro: 100000,
    enterprise: null,
  };
  const limit = TIER_LIMITS[data.tier] ?? 10000;
  const calls = data.calls_this_month ?? 0;
  if (limit !== null && calls >= limit) {
    return NextResponse.json(
      { error: "Monthly call limit reached. Please upgrade your plan at pegcheck.uk/developers" },
      { status: 429 }
    );
  }

  // Increment call count
  await supabase
    .from("api_keys")
    .update({ calls_this_month: calls + 1 })
    .eq("key", apiKey);

  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};