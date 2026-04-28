import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error, count } = await supabase
      .from("api_keys")
      .update({ calls_this_month: 0 })
      .neq("calls_this_month", 0)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Reset calls error:", error);
      return NextResponse.json({ error: "Failed to reset call counts" }, { status: 500 });
    }

    console.log(`Reset calls_this_month for ${count ?? 0} API keys`);
    return NextResponse.json({ message: `Reset complete`, rows_updated: count ?? 0 });

  } catch (error) {
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
