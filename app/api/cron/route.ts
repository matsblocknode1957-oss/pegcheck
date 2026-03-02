import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,dai,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd&vs_currencies=usd"
    );
    const data = await res.json();

    const prices: Record<string, number> = {
      usdt: data["tether"]?.usd ?? 1,
      usdc: data["usd-coin"]?.usd ?? 1,
      usds: data["dai"]?.usd ?? 1,
      ethena: data["ethena-usde"]?.usd ?? 1,
      pyusd: data["paypal-usd"]?.usd ?? 1,
      fdusd: data["first-digital-usd"]?.usd ?? 1,
      rlusd: data["ripple-usd"]?.usd ?? 1,
      tusd: data["true-usd"]?.usd ?? 1,
    };

    const coinNames: Record<string, string> = {
      usdt: "USDT (Tether)",
      usdc: "USDC (Circle)",
      usds: "USDS (MakerDAO)",
      ethena: "Ethena",
      pyusd: "PYUSD (PayPal)",
      fdusd: "FDUSD (First Digital)",
      rlusd: "RLUSD (Ripple)",
      tusd: "TUSD (TrueUSD)",
    };

    const depegged = Object.entries(prices).filter(([_, price]) => price < 1.1);

    if (depegged.length === 0) {
      return NextResponse.json({ message: "All stable, no alerts needed" });
    }

    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("email")
      .eq("tier", "premium");

    if (error || !subscribers || subscribers.length === 0) {
      return NextResponse.json({ message: "No premium subscribers to alert" });
    }

    const depegList = depegged
      .map(([slug, price]) => `<li><strong>${coinNames[slug]}</strong> — $${price.toFixed(4)}</li>`)
      .join("");

    const emailHtml = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a56db, #0e3fa8); padding: 24px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 20px;">⚠️ PegCheck Depeg Alert</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #eaecf0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; margin-top: 0;">The following stablecoins have dropped below $0.975:</p>
          <ul style="color: #374151; padding-left: 20px;">
            ${depegList}
          </ul>
          <a href="https://pegcheck.uk" style="display: inline-block; background: linear-gradient(135deg, #1a56db, #0e3fa8); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 8px;">View Live Data →</a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; margin-bottom: 0;">PegCheck premium alert. Not financial advice.</p>
        </div>
      </div>
    `;

    for (const subscriber of subscribers) {
      await resend.emails.send({
        from: "PegCheck <alerts@pegcheck.uk>",
        to: subscriber.email,
        subject: `⚠️ Depeg Alert — ${depegged.length} stablecoin${depegged.length > 1 ? "s" : ""} critical`,
        html: emailHtml,
      });
    }

    return NextResponse.json({ message: `Alerts sent to ${subscribers.length} premium subscribers` });

  } catch (error) {
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
