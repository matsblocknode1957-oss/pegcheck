import { NextResponse } from "next/server";

function makeClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET() {
  try {
    const supabase = makeClient();
    const { data, error } = await supabase
      .from("subscribers")
      .select("email, tier, weekly_report, created_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ subscribers: [], error: error.message });
    return NextResponse.json({ subscribers: data ?? [] });
  } catch {
    return NextResponse.json({ subscribers: [], error: "Failed to fetch subscribers" });
  }
}

export async function PATCH(request: Request) {
  try {
    const { email, weekly_report } = await request.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    const supabase = makeClient();
    const { error } = await supabase
      .from("subscribers")
      .update({ weekly_report })
      .eq("email", email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update subscriber" }, { status: 500 });
  }
}
