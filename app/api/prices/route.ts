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

// Chainlink feed contracts (Ethereum Mainnet, 8 decimals)
const CHAINLINK_FEEDS: Record<string, string> = {
  usdt: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  usdc: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  usds: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  tusd: "0xec746eCF986E2927Abd291a2A1716c940100f8Ba",
};

async function fetchChainlinkPrice(contract: string, rpcUrl: string): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      // latestRoundData() selector: 0xfeaf968c
      params: [{ to: contract, data: "0xfeaf968c" }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  if (!json.result || json.result === "0x") return 0;
  // ABI decode: (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  // answer is the 2nd 32-byte slot (chars 66–130 of the 0x-prefixed hex string)
  const answerHex = json.result.slice(2 + 64, 2 + 128);
  return Number(BigInt("0x" + answerHex)) / 1e8;
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

    // Source 3 — Binance (individual requests; USDT has no valid self-pair on Binance)
    const bnPairs: [string, string][] = [
      ["usdc", "USDCUSDT"],
      ["tusd", "TUSDUSDT"],
    ];
    const bnResults: Record<string, number> = {};
    await Promise.allSettled(
      bnPairs.map(async ([slug, symbol]) => {
        try {
          const r = await fetch(
            `https://api.binance.us/api/v3/ticker/price?symbol=${symbol}`,
            { cache: "no-store" }
          );
          if (!r.ok) return;
          const d = await r.json();
          if (typeof d?.price === "string") bnResults[slug] = parseFloat(d.price);
        } catch {
          // individual coin failure — continue with other sources
        }
      })
    );

    // Source 4 — Kraken (individual requests; result key may differ from queried pair name)
    const krPairs: [string, string][] = [
      ["usdt",  "USDTUSD"],
      ["usdc",  "USDCUSD"],
      ["usds",  "DAIUSD"],
      ["pyusd", "PYUSDUSD"],
      ["tusd",  "TUSDUSD"],
    ];
    const krResults: Record<string, number> = {};
    await Promise.allSettled(
      krPairs.map(async ([slug, pair]) => {
        const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
        const d = await r.json();
        const first = Object.values(d?.result ?? {})[0] as any;
        if (first?.c?.[0]) krResults[slug] = parseFloat(first.c[0]);
      })
    );

    // Source 5 — DefiLlama
    const dlRes = await fetch(`https://stablecoins.llama.fi/stablecoins?includePrices=true`);
    const dlData = await dlRes.json();
    const dlCoins = dlData?.peggedAssets ?? [];
    const dlResults: Record<string, number> = {};
    dlCoins.forEach((coin: { symbol: string; price: number }) => {
      dlResults[coin.symbol.toLowerCase()] = coin.price ?? 0;
    });

    // Source 6 — Chainlink on-chain price feeds
    const clResults: Record<string, number> = {};
    const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
    if (rpcUrl) {
      await Promise.allSettled(
        Object.entries(CHAINLINK_FEEDS).map(async ([slug, contract]) => {
          try {
            clResults[slug] = await fetchChainlinkPrice(contract, rpcUrl);
          } catch {
            // skip this feed, median continues with remaining sources
          }
        })
      );
    }

    const prices = {
      usdt:   median([cgData["tether"]?.usd ?? 0,        cbResults["USDT-USD"] ?? 0,                    krResults["usdt"]  ?? 0, dlResults["usdt"]  ?? 0, clResults["usdt"]  ?? 0]),
      usdc:   median([cgData["usd-coin"]?.usd ?? 0,      cbResults["USDC-USD"] ?? 0,  bnResults["usdc"]  ?? 0, krResults["usdc"]  ?? 0, dlResults["usdc"]  ?? 0, clResults["usdc"]  ?? 0]),
      usds:   median([cgData["dai"]?.usd ?? 0,           cbResults["DAI-USD"] ?? 0,   bnResults["usds"]  ?? 0, krResults["usds"]  ?? 0, dlResults["dai"]   ?? 0, clResults["usds"]  ?? 0]),
      ethena: median([cgData["ethena-usde"]?.usd ?? 0,                                                                                    dlResults["usde"]  ?? 0]),
      pyusd:  median([cgData["paypal-usd"]?.usd ?? 0,    cbResults["PYUSD-USD"] ?? 0, bnResults["pyusd"] ?? 0, krResults["pyusd"] ?? 0, dlResults["pyusd"] ?? 0, clResults["pyusd"] ?? 0]),
      fdusd:  median([cgData["first-digital-usd"]?.usd ?? 0,                                                                              dlResults["fdusd"] ?? 0]),
      rlusd:  median([cgData["ripple-usd"]?.usd ?? 0,                                                                                     dlResults["rlusd"] ?? 0]),
      tusd:   median([cgData["true-usd"]?.usd ?? 0,      cbResults["TUSD-USD"] ?? 0,  bnResults["tusd"]  ?? 0, krResults["tusd"]  ?? 0, dlResults["tusd"]  ?? 0, clResults["tusd"]  ?? 0]),
    };

    const sources = {
      usdt:   { coingecko: cgData["tether"]?.usd ?? 0,        coinbase: cbResults["USDT-USD"] ?? 0,                                      kraken: krResults["usdt"]  ?? 0, defillama: dlResults["usdt"]  ?? 0, chainlink: clResults["usdt"]  ?? 0 },
      usdc:   { coingecko: cgData["usd-coin"]?.usd ?? 0,      coinbase: cbResults["USDC-USD"] ?? 0,  binance: bnResults["usdc"]  ?? 0,   kraken: krResults["usdc"]  ?? 0, defillama: dlResults["usdc"]  ?? 0, chainlink: clResults["usdc"]  ?? 0 },
      usds:   { coingecko: cgData["dai"]?.usd ?? 0,           coinbase: cbResults["DAI-USD"] ?? 0,   binance: bnResults["usds"]  ?? 0,   kraken: krResults["usds"]  ?? 0, defillama: dlResults["dai"]   ?? 0, chainlink: clResults["usds"]  ?? 0 },
      ethena: { coingecko: cgData["ethena-usde"]?.usd ?? 0,                                                                                                                defillama: dlResults["usde"]  ?? 0 },
      pyusd:  { coingecko: cgData["paypal-usd"]?.usd ?? 0,    coinbase: cbResults["PYUSD-USD"] ?? 0, binance: bnResults["pyusd"] ?? 0,   kraken: krResults["pyusd"] ?? 0, defillama: dlResults["pyusd"] ?? 0, chainlink: clResults["pyusd"] ?? 0 },
      fdusd:  { coingecko: cgData["first-digital-usd"]?.usd ?? 0,                                                                                                          defillama: dlResults["fdusd"] ?? 0 },
      rlusd:  { coingecko: cgData["ripple-usd"]?.usd ?? 0,                                                                                                                 defillama: dlResults["rlusd"] ?? 0 },
      tusd:   { coingecko: cgData["true-usd"]?.usd ?? 0,      coinbase: cbResults["TUSD-USD"] ?? 0,  binance: bnResults["tusd"]  ?? 0,   kraken: krResults["tusd"]  ?? 0, defillama: dlResults["tusd"]  ?? 0, chainlink: clResults["tusd"]  ?? 0 },
    };

return NextResponse.json({ prices, sources });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
