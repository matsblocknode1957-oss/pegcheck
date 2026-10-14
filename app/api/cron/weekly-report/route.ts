import { NextResponse } from "next/server";

// Invoked by netlify/functions/weekly-report-scheduler.mts every Monday 08:00 UTC.
// Requires Authorization: Bearer <CRON_SECRET>.
// CRON_SECRET must be set — automated sends are refused without it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Weekly report cron: CRON_SECRET env var is not set");
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pegcheck.uk";

    // Forward the secret so the report handler can gate automated sends
    // against direct POST requests from unknown callers.
    const res = await fetch(`${baseUrl}/api/reports/weekly`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": secret,
      },
      body: JSON.stringify({ type: "automated" }),
    });

    const result = await res.json();
    return NextResponse.json(result);

  } catch (err) {
    console.error("Weekly report cron error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
