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
    // Source 1 — CoinGecko
    const cgIds = "tether,usd-coin,dai,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd";
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    const cgData = await cgRes.json();

    // Source 2 — Coinbase
    const cbSlugs = ["USDT-USD","USDC-USD","DAI-USD","PYUSD-USD","TUSD-USD"];
    const cbResults: Record<string, number> = {};
    await Promise.allSettled(
      cbSlugs.map(async (pair) => {
        const r = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
        const d = await r.json();
        cbResults[pair] = parseFloat(d?.data?.amount ?? "0");
      })
    );

    // Source 3 — Binance
    const bnSlugs = ["USDTUSDT","USDCUSDT","DAIUSDT","PYUSDUSDT","TUSDUSDT"];
    const bnRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(bnSlugs)}`);
    const bnData: {symbol: string; price: string}[] = await bnRes.json();
    const bnResults: Record<string, number> = {};
    bnData.forEach(item => { bnResults[item.symbol] = parseFloat(item.price); });

    // Source 4 — Kraken
    const krRes = await fetch(`https://api.kraken.com/0/public/Ticker?pair=USDTUSD,USDCUSD,DAIUSD,PYUSDUSD,TUSDUSD`);
    const krData = await krRes.json();
    const kr = krData?.result ?? {};

    // Source 5 — DefiLlama
    const dlRes = await fetch(`https://stablecoins.llama.fi/stablecoins?includePrices=true`);
    const dlData = await dlRes.json();
    const dlCoins = dlData?.peggedAssets ?? [];
    const dlResults: Record<string, number> = {};
    dlCoins.forEach((coin: { symbol: string; price: number }) => {
      dlResults[coin.symbol.toLowerCase()] = coin.price ?? 0;
    });
const prices = {
      usdt: median([
        cgData["tether"]?.usd ?? 0,
        cbResults["USDT-USD"] ?? 0,
        bnResults["USDTUSDT"] ?? 0,
        kr["USDTUSD"]?.c?.[0] ? parseFloat(kr["USDTUSD"].c[0]) : 0,
        dlResults["usdt"] ?? 0,
      ]),
      usdc: median([
        cgData["usd-coin"]?.usd ?? 0,
        cbResults["USDC-USD"] ?? 0,
        bnResults["USDCUSDT"] ?? 0,
        kr["USDCUSD"]?.c?.[0] ? parseFloat(kr["USDCUSD"].c[0]) : 0,
        dlResults["usdc"] ?? 0,
      ]),
      usds: median([
        cgData["dai"]?.usd ?? 0,
        cbResults["DAI-USD"] ?? 0,
        bnResults["DAIUSDT"] ?? 0,
        kr["DAIUSD"]?.c?.[0] ? parseFloat(kr["DAIUSD"].c[0]) : 0,
        dlResults["dai"] ?? 0,
      ]),
      ethena: median([
        cgData["ethena-usde"]?.usd ?? 0,
        dlResults["usde"] ?? 0,
      ]),
      pyusd: median([
        cgData["paypal-usd"]?.usd ?? 0,
        cbResults["PYUSD-USD"] ?? 0,
        bnResults["PYUSDUSDT"] ?? 0,
        kr["PYUSDUSD"]?.c?.[0] ? parseFloat(kr["PYUSDUSD"].c[0]) : 0,
        dlResults["pyusd"] ?? 0,
      ]),
      fdusd: median([
        cgData["first-digital-usd"]?.usd ?? 0,
        dlResults["fdusd"] ?? 0,
      ]),
      rlusd: median([
        cgData["ripple-usd"]?.usd ?? 0,
        dlResults["rlusd"] ?? 0,
      ]),
      tusd: median([
        cgData["true-usd"]?.usd ?? 0,
        cbResults["TUSD-USD"] ?? 0,
        bnResults["TUSDUSDT"] ?? 0,
        kr["TUSDUSD"]?.c?.[0] ? parseFloat(kr["TUSDUSD"].c[0]) : 0,
        dlResults["tusd"] ?? 0,
      ]),
    };

    return NextResponse.json({ prices });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
