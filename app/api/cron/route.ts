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

    const depegged = Object.entries(prices).filter(([_, price]) => price < 0.975);

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
      <h2>⚠️ PegCheck Depeg Alert</h2>
      <p>The following stablecoins have dropped below $0.975:</p>
      <ul>${depegList}</ul>
      <p>View live data: <a href="https://pegcheck.vercel.app">pegcheck.vercel.app</a></p>
      <p style="color:#9ca3af;font-size:12px;">PegCheck premium alert. Not financial advice.</p>
    `;

    for (const subscriber of subscribers) {
      await resend.emails.send({
        from: "PegCheck <onboarding@resend.dev>",
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
