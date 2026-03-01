import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2026-02-25.clover",
    });

    const { email } = await request.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "PegCheck Premium",
              description: "Instant depeg alerts when stablecoins drop below $0.975",
            },
            unit_amount: 499,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: "https://pegcheck.uk/alerts?upgraded=true",
      cancel_url: "https://pegcheck.uk/alerts",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}