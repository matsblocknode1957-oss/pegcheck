import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getApiKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string; events?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || !body.url.startsWith("https://")) {
    return NextResponse.json({ error: "url must be an https:// URL" }, { status: 400 });
  }

  const validEvents = ["depeg", "caution", "recovery"];
  const events = body.events ?? validEvents;
  if (!Array.isArray(events) || !events.every((e) => validEvents.includes(e))) {
    return NextResponse.json(
      { error: "events must be an array containing only: depeg, caution, recovery" },
      { status: 400 }
    );
  }

  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("webhooks")
      .insert({ api_key: apiKey, url: body.url, events })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ webhook: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to register webhook" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("webhooks")
      .select("id, created_at, url, events, active, last_fired, fail_count")
      .eq("api_key", apiKey)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    return NextResponse.json({ webhooks: Object.fromEntries(rows.map((w) => [String(w.id), w])) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query parameter required" }, { status: 400 });
  }

  try {
    const supabase = db();
    const { error } = await supabase
      .from("webhooks")
      .delete()
      .eq("id", id)
      .eq("api_key", apiKey);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: "Webhook deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
