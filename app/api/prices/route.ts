import { createClient } from "@supabase/supabase-js";
import { fetchEurUsd } from "@/lib/fetchEurUsd";
import { NextResponse } from "next/server";

const MAINNET_FALLBACK = "https://ethereum-rpc.publicnode.com";

// Supabase cache: prefer the latest cron snapshot when it is < 25 min old.
// Falls back to live fetching only for coins whose row is missing or stale.
const CACHE_MAX_AGE_MS = 25 * 60 * 1000;

const ALL_PRICE_SLUGS = [
  "usdt","usdc","dai","usds","ethena","pyusd","fdusd","rlusd","tusd","frax",
  "gho","crvusd","lusd","usdp","usdd","mkusd","eurc","dola","alusd","bold",
  "usdg","usd1","u","usdgo","usdf",
];

function median(values: number[]): number | null {
  const valid = values.filter(v => isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const rawMid = Math.floor(sorted.length / 2);
  const raw = sorted.length % 2 !== 0
    ? sorted[rawMid]
    : (sorted[rawMid - 1] + sorted[rawMid]) / 2;
  if (valid.length < 3) return raw;
  // 3+ sources: drop outliers > 20% from preliminary median, then re-median
  const trimmed = sorted.filter(v => Math.abs(v - raw) / raw <= 0.20);
  if (trimmed.length === 0) return raw;
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2 !== 0
    ? trimmed[mid]
    : (trimmed[mid - 1] + trimmed[mid]) / 2;
}

// Chainlink feed contracts (Ethereum Mainnet, 8 decimals)
const CHAINLINK_FEEDS: Record<string, string> = {
  usdt: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  usdc: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  dai:  "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  usds: "0xfF30586cD0F29eD462364C7e81375FC0C71219b1",
  tusd: "0xec746eCF986E2927Abd291a2A1716c940100f8Ba",
  frax: "0x9B4a96210bc8D9D55b1908B465D8B0de68B7fF83",
  usd1: "0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d",
  u:    "0xF6351B2dCF0110E76c71C1d319Af2f410454B6f3",
  usdf: "0xb177857a1799aA5F7fEb5799Fdf12CbE8fdF78B1",
};

// ETH/USD Chainlink feed (Ethereum Mainnet, 8 decimals)
const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

// Uniswap V3 pool contracts (Ethereum Mainnet) — token0=stablecoin(6dec), token1=WETH(18dec)
const UNISWAP_POOLS: Record<string, string> = {
  usdc: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", // USDC/WETH 0.05%
  usdt: "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // USDT/WETH 0.3%
};

// Returns WETH per stablecoin in human-readable units (e.g. 0.0005 for $2000 ETH).
// stablecoinIsToken0: true  → token0=stablecoin(6dec), token1=WETH(18dec) — e.g. USDC/WETH
//                    false → token0=WETH(18dec),       token1=stablecoin(6dec) — e.g. USDT/WETH
async function fetchUniswapPrice(poolAddress: string, rpcUrl: string, stablecoinIsToken0 = true): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      // slot0() selector: 0x3850c7bd
      params: [{ to: poolAddress, data: "0x3850c7bd" }, "latest"],
      id: 1,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  if (!json.result || json.result === "0x") return 0;
  // sqrtPriceX96 is the first return value (uint160, padded to 32 bytes)
  const sqrtPriceX96 = BigInt("0x" + json.result.slice(2, 66));
  // price_raw = (sqrtPriceX96 / 2^96)^2 = raw_token1 / raw_token0
  // Scale by 1e18 before integer division to preserve precision through BigInt
  const Q192 = BigInt(2) ** BigInt(192);
  const SCALE = BigInt(10 ** 18);
  const priceRawScaled = sqrtPriceX96 * sqrtPriceX96 * SCALE / Q192;
  const priceRaw = Number(priceRawScaled) / 1e18;
  // stablecoinIsToken0: price_raw = raw_WETH/raw_stable → WETH/stable = priceRaw / 1e12
  // !stablecoinIsToken0: price_raw = raw_stable/raw_WETH → WETH/stable = 1 / (priceRaw * 1e12)
  return stablecoinIsToken0 ? priceRaw / 1e12 : 1 / (priceRaw * 1e12);
}

async function fetchChainlinkPrice(contract: string, primaryUrl: string): Promise<number> {
  const urls = primaryUrl ? [primaryUrl, MAINNET_FALLBACK] : [MAINNET_FALLBACK];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          // latestRoundData() selector: 0xfeaf968c
          params: [{ to: contract, data: "0xfeaf968c" }, "latest"],
          id: 1,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.error) {
        console.warn("Chainlink RPC error:", json.error.message ?? JSON.stringify(json.error));
        continue;
      }
      if (!json.result || json.result === "0x") return 0;
      // ABI slot 1 — int256 answer
      const answerHex = json.result.slice(2 + 64, 2 + 128);
      return Number(BigInt("0x" + answerHex)) / 1e8;
    } catch (e: unknown) {
      console.warn("Chainlink fetch failed:", e instanceof Error ? e.message : String(e));
    }
  }
  return 0;
}

export async function GET() {
  try {
    // EUR/USD for EURC peg (Chainlink primary, BTC/CG fallback — not a live price source here)
    const eurUsd = await fetchEurUsd();

    // ── 1. Supabase cache ─────────────────────────────────────────────────
    // Use the latest cron snapshot for any coin whose row is < 25 min old.
    // If ALL coins are fresh, the live fetches below are skipped entirely.
    type CacheRow = { price: number; source_prices: Record<string, number> };
    const freshCache = new Map<string, CacheRow>();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const cutoff = new Date(Date.now() - CACHE_MAX_AGE_MS).toISOString();
        const { data } = await supabase
          .from("price_history")
          .select("slug, price, source_prices, created_at")
          .in("slug", ALL_PRICE_SLUGS)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(200);
        if (data) {
          for (const row of data as Array<{ slug: string } & CacheRow>) {
            // keep only the most-recent row per slug (results ordered desc)
            if (!freshCache.has(row.slug) &&
                row.source_prices && typeof row.source_prices === "object") {
              freshCache.set(row.slug, { price: row.price, source_prices: row.source_prices });
            }
          }
        }
      } catch (e) {
        console.error("Supabase cache:", e instanceof Error ? e.message : String(e));
      }
    }

    // Only hit external APIs for coins whose cache row is missing or stale
    const needLive = ALL_PRICE_SLUGS.some(s => !freshCache.has(s));

    // ── 2. Live sources (skipped when every coin has a fresh cache row) ───
    let cbResults: Record<string, number> = {};
    let bnResults: Record<string, number> = {};
    let krResults: Record<string, number> = {};
    let dlResults: Record<string, number> = {};
    let clResults: Record<string, number> = {};

    if (needLive) {
      // Source 2 — Coinbase
      const cbSlugs = ["USDT-USD","USDC-USD","DAI-USD","USDS-USD","PYUSD-USD"];
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
        ["dai",   "DAIUSD"],
        ["usds",  "USDSUSD"],
        ["pyusd", "PYUSDUSD"],
      ];
      await Promise.allSettled(
        krPairs.map(async ([slug, pair]) => {
          const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
          const d = await r.json();
          const first = Object.values(d?.result ?? {})[0] as any;
          if (first?.c?.[0]) krResults[slug] = parseFloat(first.c[0]);
        })
      );

      // Source 5 — DefiLlama
      let dlCoins: { symbol: string; name: string; price: number }[] = [];
      try {
        const dlRes = await fetch("https://stablecoins.llama.fi/stablecoins?includePrices=true", {
          signal: AbortSignal.timeout(10000),
        });
        if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status}`);
        const dlData = await dlRes.json();
        dlCoins = dlData?.peggedAssets ?? [];
      } catch (e: unknown) {
        console.error("DefiLlama source failed:", e instanceof Error ? e.message : String(e));
      }
      dlCoins.forEach((coin: { symbol: string; price: number }) => {
        dlResults[coin.symbol.toLowerCase()] = coin.price ?? 0;
      });
      // Name-exact overrides for coins where multiple tokens share the same symbol.
      // If the exact name is not found, set to 0 so the wrong token is never used.
      const dlNameOverrides: Record<string, string> = {
        usde: "Ethena USDe",
        usdp: "Pax Dollar",
        bold: "Liquity BOLD",
        frax: "Frax USD",
        usds: "Sky Dollar",
        u:    "United Stables",
        usdf: "Falcon USD",
      };
      Object.entries(dlNameOverrides).forEach(([slug, exactName]) => {
        const match = dlCoins.find((c: { name: string; price: number }) => c.name === exactName);
        dlResults[slug] = match ? (match.price ?? 0) : 0;
      });

      // Source 6 — Chainlink on-chain price feeds
      const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
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

    // ── 3. Uniswap V3 on-chain DEX prices (always live — informational only) ─
    const uniswapResults: Record<string, number> = {};
    const rpcUrl = process.env.ALCHEMY_RPC_URL ?? "";
    if (rpcUrl) {
      const [ethUsd, usdcEthPerStable, usdtEthPerStable] = await Promise.all([
        fetchChainlinkPrice(ETH_USD_FEED, rpcUrl).catch(() => 0),
        fetchUniswapPrice(UNISWAP_POOLS.usdc, rpcUrl).catch(() => 0),
        fetchUniswapPrice(UNISWAP_POOLS.usdt, rpcUrl, false).catch(() => 0),
      ]);
      if (ethUsd > 0) {
        if (usdcEthPerStable > 0) uniswapResults.usdc = ethUsd * usdcEthPerStable;
        if (usdtEthPerStable > 0) uniswapResults.usdt = ethUsd * usdtEthPerStable;
      }
    }

    // ── 4. Build prices + sources from live data (zeros when needLive=false) ─
    const prices: Record<string, number | null> = {
      usdt:   median([cbResults["USDT-USD"] ?? 0,                    krResults["usdt"]  ?? 0, dlResults["usdt"]  ?? 0, clResults["usdt"]  ?? 0]),
      usdc:   median([cbResults["USDC-USD"] ?? 0,  bnResults["usdc"]  ?? 0, krResults["usdc"]  ?? 0, dlResults["usdc"]  ?? 0, clResults["usdc"]  ?? 0]),
      dai:    median([cbResults["DAI-USD"]  ?? 0,                    krResults["dai"]   ?? 0, dlResults["dai"]   ?? 0, clResults["dai"]   ?? 0]),
      usds:   median([cbResults["USDS-USD"] ?? 0,   bnResults["usds"]  ?? 0, krResults["usds"]  ?? 0, dlResults["usds"]   ?? 0, clResults["usds"]  ?? 0]),
      ethena: median([dlResults["usde"]  ?? 0]),
      pyusd:  median([cbResults["PYUSD-USD"] ?? 0, bnResults["pyusd"] ?? 0, krResults["pyusd"] ?? 0, dlResults["pyusd"] ?? 0, clResults["pyusd"] ?? 0]),
      fdusd:  median([dlResults["fdusd"] ?? 0]),
      rlusd:  median([dlResults["rlusd"] ?? 0]),
      tusd:   median([bnResults["tusd"]  ?? 0, dlResults["tusd"]  ?? 0, clResults["tusd"]  ?? 0]),
      frax:   median([dlResults["frax"]   ?? 0, clResults["frax"]  ?? 0]),
      gho:    median([dlResults["gho"]    ?? 0]),
      crvusd: median([dlResults["crvusd"] ?? 0]),
      lusd:   median([dlResults["lusd"]   ?? 0]),
      usdp:   median([dlResults["usdp"]  ?? 0]),
      usdd:   median([dlResults["usdd"]   ?? 0]),
      mkusd:  median([dlResults["mkusd"]  ?? 0]),
      eurc:   median([dlResults["eurc"]   ?? 0]),
      dola:   median([dlResults["dola"]   ?? 0]),
      alusd:  median([dlResults["alusd"]  ?? 0]),
      bold:   median([dlResults["bold"]   ?? 0]),
      usdg:   median([dlResults["usdg"]   ?? 0]),
      usd1:   median([dlResults["usd1"]   ?? 0, clResults["usd1"]  ?? 0]),
      u:      median([dlResults["u"]      ?? 0, clResults["u"]     ?? 0]),
      usdgo:  median([dlResults["usdgo"]  ?? 0]),
      usdf:   median([dlResults["usdf"]   ?? 0, clResults["usdf"]  ?? 0]),
    };

    const sources: Record<string, Record<string, number>> = {
      usdt:   { coinbase: cbResults["USDT-USD"] ?? 0,                                    kraken: krResults["usdt"]  ?? 0, defillama: dlResults["usdt"]  ?? 0, chainlink: clResults["usdt"]  ?? 0 },
      usdc:   { coinbase: cbResults["USDC-USD"] ?? 0,  binance: bnResults["usdc"]  ?? 0, kraken: krResults["usdc"]  ?? 0, defillama: dlResults["usdc"]  ?? 0, chainlink: clResults["usdc"]  ?? 0 },
      dai:    { coinbase: cbResults["DAI-USD"]  ?? 0,                                    kraken: krResults["dai"]   ?? 0, defillama: dlResults["dai"]   ?? 0, chainlink: clResults["dai"]   ?? 0 },
      usds:   { coinbase: cbResults["USDS-USD"] ?? 0,  binance: bnResults["usds"]  ?? 0, kraken: krResults["usds"]  ?? 0, defillama: dlResults["usds"]   ?? 0, chainlink: clResults["usds"]  ?? 0 },
      ethena: { defillama: dlResults["usde"]  ?? 0 },
      pyusd:  { coinbase: cbResults["PYUSD-USD"] ?? 0, binance: bnResults["pyusd"] ?? 0, kraken: krResults["pyusd"] ?? 0, defillama: dlResults["pyusd"] ?? 0, chainlink: clResults["pyusd"] ?? 0 },
      fdusd:  { defillama: dlResults["fdusd"] ?? 0 },
      rlusd:  { defillama: dlResults["rlusd"] ?? 0 },
      tusd:   { binance: bnResults["tusd"]  ?? 0, defillama: dlResults["tusd"]  ?? 0, chainlink: clResults["tusd"]  ?? 0 },
      frax:   { defillama: dlResults["frax"]   ?? 0, chainlink: clResults["frax"]  ?? 0 },
      gho:    { defillama: dlResults["gho"]    ?? 0 },
      crvusd: { defillama: dlResults["crvusd"] ?? 0 },
      lusd:   { defillama: dlResults["lusd"]   ?? 0 },
      usdp:   { defillama: dlResults["usdp"]   ?? 0 },
      usdd:   { defillama: dlResults["usdd"]   ?? 0 },
      mkusd:  { defillama: dlResults["mkusd"]  ?? 0 },
      eurc:   { defillama: dlResults["eurc"]   ?? 0 },
      dola:   { defillama: dlResults["dola"]   ?? 0 },
      alusd:  { defillama: dlResults["alusd"]  ?? 0 },
      bold:   { defillama: dlResults["bold"]   ?? 0 },
      usdg:   { defillama: dlResults["usdg"]   ?? 0 },
      usd1:   { defillama: dlResults["usd1"]   ?? 0, chainlink: clResults["usd1"]  ?? 0 },
      u:      { defillama: dlResults["u"]      ?? 0, chainlink: clResults["u"]     ?? 0 },
      usdgo:  { defillama: dlResults["usdgo"]  ?? 0 },
      usdf:   { defillama: dlResults["usdf"]   ?? 0, chainlink: clResults["usdf"]  ?? 0 },
    };

    // ── 5. Overlay fresh Supabase rows ─────────────────────────────────────
    // The cron snapshot carries richer source coverage (CoinGecko, CMC, etc.)
    // and is the authoritative price for any coin whose row is < 25 min old.
    for (const [slug, row] of freshCache) {
      if (slug in prices) {
        prices[slug] = row.price;
        sources[slug] = row.source_prices;
      }
    }

    const uniswap = {
      usdc: {
        pool_price: uniswapResults["usdc"] ?? 0,
        consensus_price: prices.usdc,
        divergence_bps: prices.usdc !== null
          ? Math.round(Math.abs((uniswapResults["usdc"] ?? 0) - prices.usdc) * 10000)
          : null,
      },
      usdt: {
        pool_price: uniswapResults["usdt"] ?? 0,
        consensus_price: prices.usdt,
        divergence_bps: prices.usdt !== null
          ? Math.round(Math.abs((uniswapResults["usdt"] ?? 0) - prices.usdt) * 10000)
          : null,
      },
    };

    return NextResponse.json({ prices, sources, uniswap, eurUsd });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
