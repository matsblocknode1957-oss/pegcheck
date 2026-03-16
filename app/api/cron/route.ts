import { NextResponse } from "next/server";

function median(values: number[]): number {
  const sorted = values.filter(v => v > 0.5 && v < 1.5).sort((a, b) => a - b);
  if (sorted.length === 0) return 1.0;
  if (sorted.length === 1) return sorted[0];
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function GET() {
  try {
    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

    // CoinGecko
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,dai,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd&vs_currencies=usd"
    );
    const cgData = await cgRes.json();

    // Coinbase
    const cbSlugs = ["USDT-USD","USDC-USD","DAI-USD","PYUSD-USD","TUSD-USD"];
    const cbResults: Record<string, number> = {};
    await Promise.allSettled(
      cbSlugs.map(async (pair) => {
        const r = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
        const d = await r.json();
        cbResults[pair] = parseFloat(d?.data?.amount ?? "0");
      })
    );

    // Binance
    const bnSlugs = ["USDTUSDT","USDCUSDT","DAIUSDT","PYUSDUSDT","TUSDUSDT"];
    const bnRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(bnSlugs)}`);
    const bnData: {symbol: string; price: string}[] = await bnRes.json();
    const bnResults: Record<string, number> = {};
    if (Array.isArray(bnData)) {
      bnData.forEach(item => { bnResults[item.symbol] = parseFloat(item.price); });
    }

    // Kraken
    const krRes = await fetch("https://api.kraken.com/0/public/Ticker?pair=USDTUSD,USDCUSD,DAIUSD,PYUSDUSD,TUSDUSD");
    const krData = await krRes.json();
    const kr = krData?.result ?? {};

    // DefiLlama
    const dlRes = await fetch("https://stablecoins.llama.fi/stablecoins?includePrices=true");
    const dlData = await dlRes.json();
    const dlCoins = dlData?.peggedAssets ?? [];
    const dlResults: Record<string, number> = {};
    dlCoins.forEach((coin: { symbol: string; price: number }) => {
      dlResults[coin.symbol.toLowerCase()] = coin.price ?? 0;
    });

    
      // Etherscan — USDT Large Transactions & Mint/Burn
// Etherscan — Large Transactions for all coins
    const contracts: { slug: string; address: string; decimals: number }[] = [
      { slug: "usdt", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
      { slug: "usdc", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
      { slug: "usds", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
      { slug: "ethena", address: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3", decimals: 18 },
      { slug: "pyusd", address: "0x6c3ea9036406852006290770bedfcaba0e23a0e8", decimals: 6 },
      { slug: "fdusd", address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", decimals: 18 },
      { slug: "rlusd", address: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", decimals: 18 },
      { slug: "tusd", address: "0x0000000000085d4780B73119b644AE5ecd22b376", decimals: 18 },
    ];

    for (const coin of contracts) {
      try {
        const ethRes = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${coin.address}&page=1&offset=50&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`
        );
        const ethData = await ethRes.json();
        const txList = ethData?.result ?? [];
        if (Array.isArray(txList) && txList.length > 0) {
          const zeroAddress = "0x0000000000000000000000000000000000000000";
          const significant = txList.filter((tx: any) => {
            const amount = parseFloat(tx.value) / Math.pow(10, coin.decimals);
           const isMintBurn = (tx.from === zeroAddress || tx.to === zeroAddress) && amount >= 1000 && amount <= 500000000;
const isLarge = amount >= 100000 && amount <= 500000000;
return isMintBurn || isLarge;
          });
          const rows = significant.map((tx: any) => {
            const amount = parseFloat(tx.value) / Math.pow(10, coin.decimals);
            let action = "large_transfer";
            if (tx.from === zeroAddress) action = "mint";
            if (tx.to === zeroAddress) action = "burn";
            return {
              slug: coin.slug,
              action,
              amount,
              tx_hash: tx.hash,
              wallet: tx.from,
            };
          });

          if (rows.length > 0) {
            await supabase.from("large_transactions").upsert(rows, { onConflict: "tx_hash", ignoreDuplicates: true });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch transactions for ${coin.slug}`, e);
      }
    }

    // Compute Median Prices
    const prices: Record<string, number> = {
      usdt: median([cgData["tether"]?.usd ?? 0, cbResults["USDT-USD"] ?? 0, bnResults["USDTUSDT"] ?? 0, kr["USDTUSD"]?.c?.[0] ? parseFloat(kr["USDTUSD"].c[0]) : 0, dlResults["usdt"] ?? 0]),
      usdc: median([cgData["usd-coin"]?.usd ?? 0, cbResults["USDC-USD"] ?? 0, bnResults["USDCUSDT"] ?? 0, kr["USDCUSD"]?.c?.[0] ? parseFloat(kr["USDCUSD"].c[0]) : 0, dlResults["usdc"] ?? 0]),
      usds: median([cgData["dai"]?.usd ?? 0, cbResults["DAI-USD"] ?? 0, bnResults["DAIUSDT"] ?? 0, kr["DAIUSD"]?.c?.[0] ? parseFloat(kr["DAIUSD"].c[0]) : 0, dlResults["dai"] ?? 0]),
      ethena: median([cgData["ethena-usde"]?.usd ?? 0, dlResults["usde"] ?? 0]),
      pyusd: median([cgData["paypal-usd"]?.usd ?? 0, cbResults["PYUSD-USD"] ?? 0, bnResults["PYUSDUSDT"] ?? 0, kr["PYUSDUSD"]?.c?.[0] ? parseFloat(kr["PYUSDUSD"].c[0]) : 0, dlResults["pyusd"] ?? 0]),
      fdusd: median([cgData["first-digital-usd"]?.usd ?? 0, dlResults["fdusd"] ?? 0]),
      rlusd: median([cgData["ripple-usd"]?.usd ?? 0, dlResults["rlusd"] ?? 0]),
      tusd: median([cgData["true-usd"]?.usd ?? 0, cbResults["TUSD-USD"] ?? 0, bnResults["TUSDUSDT"] ?? 0, kr["TUSDUSD"]?.c?.[0] ? parseFloat(kr["TUSDUSD"].c[0]) : 0, dlResults["tusd"] ?? 0]),
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

    // Save Price Snapshot
    const snapshots = Object.entries(prices).map(([slug, price]) => ({ slug, price }));
    const { error: priceError } = await supabase.from("price_history").insert(snapshots);
if (priceError) console.error("Price history insert error:", priceError);
else console.log("Price history saved:", snapshots.length, "rows");

    // Check for Depegs
    const depegged = Object.entries(prices).filter(([_, price]) => price < 0.975);
    if (depegged.length === 0) {
      return NextResponse.json({ message: "All stable, no alerts needed" });
    }

    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("email")
      .eq("tier", "premium");

    if (subError || !subscribers || subscribers.length === 0) {
      return NextResponse.json({ message: "No premium subscribers to alert" });
    }

    const depegList = depegged.map(([slug, price]) => `<li><strong>${coinNames[slug]}</strong> — $${price.toFixed(4)}</li>`).join("");

    const emailHtml = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a56db, #0e3fa8); padding: 24px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 20px;">PegCheck — Stablecoin Alert</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #eaecf0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; margin-top: 0;">The following stablecoins have dropped below $0.975:</p>
          <ul style="color: #374151; padding-left: 20px;">
            ${depegList}
          </ul>
          <a href="https://pegcheck.uk" style="display: inline-block; background: linear-gradient(135deg, #1a56db, #0e3fa8); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 8px;">View Live Data →</a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; margin-bottom: 0;">PegCheck premium alert. Not financial advice. <a href="https://pegcheck.uk" style="color: #9ca3af;">Manage subscription</a></p>
        </div>
      </div>
    `;

    for (const subscriber of subscribers) {
      await resend.emails.send({
        from: "PegCheck <alerts@pegcheck.uk>",
        to: subscriber.email,
        subject: `PegCheck — Stablecoin price alert`,
        html: emailHtml,
      });
    }

    return NextResponse.json({ message: `Snapshots saved. Alerts sent to ${subscribers.length} premium subscribers.` });

  } catch (error) {
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}