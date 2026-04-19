import Stripe from "stripe";
import { NextResponse } from "next/server";

const TIERS: Record<string, { amount: number; name: string; description: string }> = {
  starter: {
    amount: 9900,
    name: "PegCheck Starter",
    description: "10,000 API calls/month — all 8 stablecoins, price history, email support",
  },
  pro: {
    amount: 24900,
    name: "PegCheck Pro",
    description: "100,000 API calls/month — webhook alerts, priority support",
  },
  enterprise: {
    amount: 49900,
    name: "PegCheck Enterprise",
    description: "Unlimited API calls — 99.9% SLA, custom coins, dedicated support",
  },
};

export async function POST(request: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2026-02-25.clover",
    });

    const { email, tier } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const tierConfig = TIERS[tier];
    if (!tierConfig) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      metadata: { tier },
      subscription_data: {
        trial_period_days: 30,
        metadata: { tier },
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: tierConfig.name,
              description: tierConfig.description,
            },
            unit_amount: tierConfig.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: "https://pegcheck.uk/developers?success=true",
      cancel_url: "https://pegcheck.uk/developers",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
