import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, threshold, coins, api_key } = body;

    if (!url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    if (!api_key) {
      return NextResponse.json(
        { error: "api_key is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("webhooks")
      .insert({
        url,
        threshold: threshold ?? 1.0,
        coins: coins ? coins.join(",") : "all",
        api_key,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to register webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Webhook registered successfully",
      webhook: data,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to register webhook" },
      { status: 500 }
    );
  }
}