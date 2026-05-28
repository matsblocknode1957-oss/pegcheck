import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("email")
      .eq("weekly_report", true);

    if (error) {
      console.error("Weekly report cron — subscriber query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ message: "No subscribers opted in to weekly reports", sent: 0 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pegcheck.uk";

    const results = await Promise.allSettled(
      subscribers.map(sub =>
        fetch(`${baseUrl}/api/reports/weekly`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: sub.email, type: "automated" }),
        })
      )
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed    = results.filter(r => r.status === "rejected").length;

    console.log(`Weekly report cron: sent=${succeeded} failed=${failed} total=${subscribers.length}`);

    return NextResponse.json({
      message: "Weekly reports dispatched",
      sent: succeeded,
      failed,
      total: subscribers.length,
    });

  } catch (err) {
    console.error("Weekly report cron error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
