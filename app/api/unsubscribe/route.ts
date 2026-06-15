import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return htmlResponse(400, "Invalid link", "This unsubscribe link is missing a token.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("subscribers")
    .update({ weekly_report: false, alerts_enabled: false })
    .eq("unsubscribe_token", token)
    .select("email")
    .single();

  if (error || !data) {
    return htmlResponse(404, "Link not found", "This unsubscribe link is invalid or expired.");
  }

  return htmlResponse(200, "Unsubscribed", `${data.email} has been removed from all FintechCheck emails.`);
}

function htmlResponse(status: number, title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — FintechCheck</title>
</head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center">
  <div style="max-width:480px;width:100%;margin:40px auto;padding:0 16px;text-align:center">
    <div style="background:#0d1628;border:1px solid #1e2a40;border-radius:12px;padding:40px 32px">
      <div style="font-size:40px;margin-bottom:16px">${status === 200 ? "✓" : "✕"}</div>
      <div style="font-size:20px;font-weight:700;color:#f9fafb;margin-bottom:12px">${title}</div>
      <p style="font-size:14px;color:#9ca3af;margin:0 0 28px;line-height:1.6">${message}</p>
      <a href="https://pegcheck.uk" style="display:inline-block;background:#1a56db;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Return to PegCheck</a>
    </div>
    <p style="font-size:11px;color:#374151;margin-top:20px">FintechCheck · Real-time stablecoin monitoring</p>
  </div>
</body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
