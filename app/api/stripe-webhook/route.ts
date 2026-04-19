import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  return "pk_live_" + randomBytes(24).toString("hex");
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2026-02-25.clover",
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email = session.customer_email;
  const tier = session.metadata?.tier;

  // Only handle API subscription checkouts (those with a tier in metadata)
  if (!tier) {
    return NextResponse.json({ received: true });
  }

  if (!email) {
    console.error("Missing email in session:", session.id);
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const apiKey = generateApiKey();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: dbError } = await supabase.from("api_keys").insert([
    {
      key: apiKey,
      email,
      tier,
      active: true,
      calls_this_month: 0,
    },
  ]);

  if (dbError) {
    console.error("Failed to save API key:", dbError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  await resend.emails.send({
    from: "PegCheck <api@fintechcheck.uk>",
    to: email,
    subject: "Your PegCheck API Key",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #c9d1d9; background: #0d1117; padding: 32px; border-radius: 12px;">
        <h2 style="color: #ffffff; margin-top: 0;">Your PegCheck API Key — ${tierLabel} Plan</h2>
        <p>Your key is active. Add it as a Bearer token in your Authorization header:</p>
        <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 14px; color: #58a6ff; margin: 16px 0; word-break: break-all;">
          ${apiKey}
        </div>
        <p style="margin-bottom: 8px;"><strong>Quick start:</strong></p>
        <pre style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; font-size: 13px; overflow-x: auto;">fetch("https://pegcheck.uk/api/v1/coins", {
  headers: { Authorization: "Bearer ${apiKey}" }
})</pre>
        <p>
          View the full API docs at
          <a href="https://pegcheck.uk/developers/docs" style="color: #58a6ff;">pegcheck.uk/developers/docs</a>
        </p>
        <p style="color: #666; font-size: 12px; margin-bottom: 0;">Keep this key secure — treat it like a password and never commit it to version control.</p>
      </div>
    `,
  });

  return NextResponse.json({ received: true });
}
