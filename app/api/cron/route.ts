import { NextResponse } from "next/server";
import { COIN_PEGS } from "@/lib/coinPegs";
import { fetchEurUsd } from "@/lib/fetchEurUsd";

// Temporarily excluded from alerts — persistent depeg, remove when recovered
const EXCLUDED_FROM_ALERTS: string[] = [];

const MAINNET_FALLBACK = "https://ethereum-rpc.publicnode.com";

async function ethCallWithRetry(contract: string, data: string, primaryUrl: string): Promise<string | null> {
  const urls = primaryUrl ? [primaryUrl, MAINNET_FALLBACK] : [MAINNET_FALLBACK];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.error) {
        console.warn("Chainlink RPC error:", json.error.message ?? JSON.stringify(json.error));
        continue;
      }
      if (!json.result || json.result === "0x") return null;
      return json.result;
    } catch (e: unknown) {
      console.warn("Chainlink fetch failed:", e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}

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

// Chainlink price feed contracts (Ethereum Mainnet, 8 decimals)
const CHAINLINK_FEEDS: Record<string, string> = {
  usdt: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  usdc: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  usds: "0xfF30586cD0F29eD462364C7e81375FC0C71219b1",
  tusd: "0xec746eCF986E2927Abd291a2A1716c940100f8Ba",
  frax: "0x9B4a96210bc8D9D55b1908B465D8B0de68B7fF83",
};

// Chainlink Proof of Reserve feed contracts (Ethereum Mainnet, 8 decimals)
const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

async function callLatestRoundData(contract: string, rpcUrl: string): Promise<string | null> {
  return ethCallWithRetry(contract, "0xfeaf968c", rpcUrl);
}

async function fetchChainlinkPrice(contract: string, rpcUrl: string): Promise<number> {
  const result = await callLatestRoundData(contract, rpcUrl);
  if (!result) return 0;
  // ABI slot 1 — int256 answer
  const answerHex = result.slice(2 + 64, 2 + 128);
  return Number(BigInt("0x" + answerHex)) / 1e8;
}

async function fetchChainlinkPoR(
  contract: string,
  rpcUrl: string
): Promise<{ reserves: number; updated_at: string } | null> {
  try {
    // decimals() = 0x313ce567 — TUSD PoR feed has 18 decimals, not 8
    const decimalsHex = await ethCallWithRetry(contract, "0x313ce567", rpcUrl);
    const decimals = decimalsHex ? Number(BigInt(decimalsHex)) : 8;
    const result = await callLatestRoundData(contract, rpcUrl);
    if (!result) return null;
    const hex = result.slice(2);
    // ABI slot 1 — int256 answer (reserves)
    const reserves = Number(BigInt("0x" + hex.slice(64, 128))) / Math.pow(10, decimals);
    // ABI slot 3 — uint256 updatedAt
    const updatedAt = Number(BigInt("0x" + hex.slice(192, 256)));
    if (reserves <= 0) return null;
    return { reserves, updated_at: new Date(updatedAt * 1000).toISOString() };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization") ?? "";
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const eurUsd = await fetchEurUsd();
    // eurUsd ?? COIN_PEGS.eurc is dead code when prices.eurc is null (see below),
    // but keeps effectivePeg returning number so callers need no null guards.
    const effectivePeg = (slug: string): number =>
      slug === "eurc" ? (eurUsd ?? COIN_PEGS.eurc) : (COIN_PEGS[slug] ?? 1.0);

    // CoinGecko
    const cgKey = process.env.COINGECKO_API_KEY;
    let cgData: Record<string, { usd?: number }> = {};
    try {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,usds,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd,frax-usd,gho,crvusd,liquity-usd,paxos-standard,usdd,prisma-mkusd,euro-coin,dola-usd,alchemix-usd,liquity-bold-2,global-dollar&vs_currencies=usd",
        {
          signal: AbortSignal.timeout(10000),
          ...(cgKey ? { headers: { "x-cg-demo-api-key": cgKey } } : {}),
        }
      );
      if (!cgRes.ok) throw new Error(`HTTP ${cgRes.status}`);
      cgData = await cgRes.json();
    } catch (e: unknown) {
      console.error("CoinGecko source failed:", e instanceof Error ? e.message : String(e));
    }

    // Coinbase
    const cbSlugs = ["USDT-USD","USDC-USD","USDS-USD","PYUSD-USD"];
    const cbResults: Record<string, number> = {};
    await Promise.allSettled(
      cbSlugs.map(async (pair) => {
        const r = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
        const d = await r.json();
        cbResults[pair] = parseFloat(d?.data?.amount ?? "0");
      })
    );

    // Binance (individual requests; USDT has no valid self-pair on Binance)
    const bnPairs: [string, string][] = [
      ["usdc", "USDCUSDT"],
      ["tusd", "TUSDUSDT"],
    ];
    const bnResults: Record<string, number> = {};
    await Promise.allSettled(
      bnPairs.map(async ([slug, symbol]) => {
        const r = await fetch(`https://api.binance.us/api/v3/ticker/price?symbol=${symbol}`);
        const d = await r.json();
        if (d?.price) bnResults[slug] = parseFloat(d.price);
      })
    );

    // Kraken (individual requests; result key may differ from queried pair name)
    const krPairs: [string, string][] = [
      ["usdt",  "USDTUSD"],
      ["usdc",  "USDCUSD"],
      ["usds",  "USDSUSD"],
      ["pyusd", "PYUSDUSD"],
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

    // DefiLlama
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
    const dlResults: Record<string, number> = {};
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
    };
    Object.entries(dlNameOverrides).forEach(([slug, exactName]) => {
      const match = dlCoins.find((c: { name: string; price: number }) => c.name === exactName);
      dlResults[slug] = match ? (match.price ?? 0) : 0;
    });

    // Chainlink on-chain price feeds
    const clResults: Record<string, number> = {};
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

    // Chainlink Proof of Reserve feeds
    const porResults: Record<string, { reserves: number; updated_at: string } | null> = {};
    await Promise.allSettled(
      Object.entries(POR_FEEDS).map(async ([slug, contract]) => {
        porResults[slug] = await fetchChainlinkPoR(contract, rpcUrl);
      })
    );

    // Etherscan — Large Transactions for all coins
    const contracts: { slug: string; address: string; decimals: number }[] = [
      { slug: "usdt",   address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6  },
      { slug: "usdc",   address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6  },
      { slug: "usds",   address: "0xdc035d45d973e3ec169d2276ddab16f1e407384f", decimals: 18 },
      { slug: "ethena", address: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3", decimals: 18 },
      { slug: "pyusd",  address: "0x6c3ea9036406852006290770bedfcaba0e23a0e8", decimals: 6  },
      { slug: "fdusd",  address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", decimals: 18 },
      { slug: "rlusd",  address: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", decimals: 18 },
      { slug: "tusd",   address: "0x0000000000085d4780B73119b644AE5ecd22b376", decimals: 18 },
      { slug: "frax",   address: "0xcacd6fd266af91b8aed52accc382b4e165586e29", decimals: 18 },
      { slug: "gho",    address: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", decimals: 18 },
      { slug: "crvusd", address: "0xf939E0A03FB07F59A73314E73794be0E57ac1b4E", decimals: 18 },
      { slug: "lusd",   address: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0", decimals: 18 },
      { slug: "usdp",   address: "0x8E870D67F660D95d5be530380D0eC0bd388289E1", decimals: 18 },
      { slug: "usdd",   address: "0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6", decimals: 18 },
      { slug: "mkusd",  address: "0x4591DBfF62656E7859Afe5e45f6f47D3669fBB28", decimals: 18 },
      { slug: "eurc",   address: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c", decimals: 6  },
      { slug: "dola",   address: "0x865377367054516e17014CcDed1e7d814EDC9ce4", decimals: 18 },
      { slug: "alusd",  address: "0xBC6DA0FE9aD5f3b0d58160288917AA56653660e9", decimals: 18 },
      { slug: "bold",   address: "0x6440f144b7e50d6a8439336510312d2f54beb01d", decimals: 18 },
      { slug: "usdg",   address: "0xe343167631d89B6Ffc58B88d6b7fB0228795491D", decimals: 6  },
    ];

    for (const coin of contracts) {
      try {
        const ethRes = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${coin.address}&page=1&offset=50&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`
        );
        const ethData = await ethRes.json();
        const txList = ethData?.result ?? [];
        console.log(`Etherscan ${coin.slug}:`, typeof txList === 'string' ? txList : `${txList.length} txs`);
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
            let action = "LARGE TRANSFER";
            if (tx.from === zeroAddress) action = "MINT";
            if (tx.to === zeroAddress) action = "BURN";
            return {
              slug: coin.slug,
              action,
              amount,
              tx_hash: tx.hash,
              wallet: tx.from,
            };
          });

          if (rows.length > 0) {
            const { error: txError } = await supabase.from("large_transactions").upsert(rows, { onConflict: "tx_hash", ignoreDuplicates: true });
            if (txError) console.error("Large tx insert error:", txError);
            else console.log("Large tx saved for", coin.slug, rows.length, "rows");
          }
        }
      } catch (e) {
        console.error(`Failed to fetch transactions for ${coin.slug}`, e);
      }
      // Delay between each coin to avoid Etherscan rate limit
      await new Promise(r => setTimeout(r, 400));
    }

    // Compute Median Prices
    const prices: Record<string, number | null> = {
      usdt:   median([cgData["tether"]?.usd ?? 0,        cbResults["USDT-USD"] ?? 0,                                  krResults["usdt"]  ?? 0, dlResults["usdt"]  ?? 0, clResults["usdt"]  ?? 0]),
      usdc:   median([cgData["usd-coin"]?.usd ?? 0,      cbResults["USDC-USD"] ?? 0,  bnResults["usdc"]  ?? 0,        krResults["usdc"]  ?? 0, dlResults["usdc"]  ?? 0, clResults["usdc"]  ?? 0]),
      usds:   median([cgData["usds"]?.usd ?? 0,           cbResults["USDS-USD"] ?? 0,   bnResults["usds"]  ?? 0,        krResults["usds"]  ?? 0, dlResults["usds"]   ?? 0, clResults["usds"]  ?? 0]),
      ethena: median([cgData["ethena-usde"]?.usd ?? 0,                                                                                           dlResults["usde"]  ?? 0]),
      pyusd:  median([cgData["paypal-usd"]?.usd ?? 0,    cbResults["PYUSD-USD"] ?? 0, bnResults["pyusd"] ?? 0,        krResults["pyusd"] ?? 0, dlResults["pyusd"] ?? 0, clResults["pyusd"] ?? 0]),
      fdusd:  median([cgData["first-digital-usd"]?.usd ?? 0,                                                                                     dlResults["fdusd"] ?? 0]),
      rlusd:  median([cgData["ripple-usd"]?.usd ?? 0,                                                                                            dlResults["rlusd"] ?? 0]),
      tusd:   median([cgData["true-usd"]?.usd ?? 0,      bnResults["tusd"]  ?? 0, dlResults["tusd"]  ?? 0, clResults["tusd"]  ?? 0]),
      frax:   median([cgData["frax-usd"]?.usd      ?? 0, dlResults["frax"]   ?? 0, clResults["frax"]  ?? 0]),
      gho:    median([cgData["gho"]?.usd           ?? 0, dlResults["gho"]    ?? 0]),
      crvusd: median([cgData["crvusd"]?.usd        ?? 0, dlResults["crvusd"] ?? 0]),
      lusd:   median([cgData["liquity-usd"]?.usd   ?? 0, dlResults["lusd"]   ?? 0]),
      usdp:   median([cgData["paxos-standard"]?.usd ?? 0, dlResults["usdp"]  ?? 0]),
      usdd:   median([cgData["usdd"]?.usd          ?? 0, dlResults["usdd"]   ?? 0]),
      mkusd:  median([cgData["prisma-mkusd"]?.usd  ?? 0, dlResults["mkusd"]  ?? 0]),
      eurc:   median([cgData["euro-coin"]?.usd     ?? 0, dlResults["eurc"]   ?? 0]),
      dola:   median([cgData["dola-usd"]?.usd      ?? 0, dlResults["dola"]   ?? 0]),
      alusd:  median([cgData["alchemix-usd"]?.usd  ?? 0, dlResults["alusd"]  ?? 0]),
      bold:   median([cgData["liquity-bold-2"]?.usd          ?? 0, dlResults["bold"]   ?? 0]),
      usdg:   median([cgData["global-dollar"]?.usd  ?? 0, dlResults["usdg"]   ?? 0]),
    };

    // When EUR/USD rate unavailable, treat EURC as no data so it is excluded
    // from snapshots, depeg/caution checks, alerts, and on-chain logging.
    if (eurUsd === null) prices.eurc = null;

    const coinNames: Record<string, string> = {
      usdt: "USDT (Tether)",
      usdc: "USDC (Circle)",
      usds: "USDS (MakerDAO)",
      ethena: "Ethena",
      pyusd: "PYUSD (PayPal)",
      fdusd: "FDUSD (First Digital)",
      rlusd: "RLUSD (Ripple)",
      tusd:   "TUSD (TrueUSD)",
      frax:   "frxUSD (Frax Finance)",
      gho:    "GHO (Aave)",
      crvusd: "crvUSD (Curve Finance)",
      lusd:   "LUSD (Liquity)",
      usdp:   "USDP (Paxos)",
      usdd:   "USDD (TRON DAO)",
      mkusd:  "mkUSD (Prisma Finance)",
      eurc:   "EURC (Circle)",
      dola:   "DOLA (Inverse Finance)",
      alusd:  "alUSD (Alchemix)",
      bold:   "BOLD (Liquity V2)",
      usdg:   "USDG (Global Dollar)",
    };

    // Save Price Snapshot
    const snapshots = Object.entries(prices)
      .filter((e): e is [string, number] => e[1] !== null)
      .map(([slug, price]) => ({
        slug,
        price,
        deviation_bps: Math.round((price - effectivePeg(slug)) / effectivePeg(slug) * 10000),
      }));
    const { error: priceError } = await supabase.from("price_history").insert(snapshots);
    if (priceError) console.error("Price history insert error:", priceError);
    else console.log("Price history saved:", snapshots.length, "rows");

    // Build set of seasoned slugs — coins with ≥ 30 days of price history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const seasoningResults = await Promise.all(
      Object.keys(prices).map(async (slug) => {
        const { data } = await supabase
          .from("price_history")
          .select("created_at")
          .eq("slug", slug)
          .order("created_at", { ascending: true })
          .limit(1);
        const firstRecord = data?.[0]?.created_at;
        return { slug, seasoned: !!firstRecord && firstRecord < thirtyDaysAgo };
      })
    );
    const seasonedSlugs = new Set(
      seasoningResults.filter(c => c.seasoned).map(c => c.slug)
    );

    // Check for Depegs — only alert if coin has ≥2 history records AND wasn't already depegged last cycle
    const currentlyDepegged = Object.entries(prices).filter(
      (e): e is [string, number] => e[1] !== null && e[1] < effectivePeg(e[0]) * 0.975
    );

    const depegChecks = await Promise.all(
      currentlyDepegged.map(async ([slug]) => {
        if (!seasonedSlugs.has(slug)) return null; // < 30 days of history — skip
        const { data } = await supabase
          .from("price_history")
          .select("price")
          .eq("slug", slug)
          .order("created_at", { ascending: false })
          .limit(2);
        if (!data || data.length < 2) return null; // first ever fetch — skip
        const prevPrice = Number(data[1].price);
        if (prevPrice < effectivePeg(slug) * 0.975) return null; // already depegged last cycle — skip
        return slug;
      })
    );
    const alertableSlugs = new Set(depegChecks.filter(Boolean));
    const depegged = currentlyDepegged.filter(([slug]) =>
      alertableSlugs.has(slug) && !EXCLUDED_FROM_ALERTS.includes(slug)
    );

    // Recovery detection — was depegged last cycle, now back above 2.5% threshold
    const recoveryResults = await Promise.all(
      Object.entries(prices)
        .filter((e): e is [string, number] => e[1] !== null && e[1] >= effectivePeg(e[0]) * 0.975)
        .map(async ([slug, price]) => {
          if (!seasonedSlugs.has(slug)) return null; // < 30 days of history — skip
          const { data } = await supabase
            .from("price_history")
            .select("price")
            .eq("slug", slug)
            .order("created_at", { ascending: false })
            .limit(2);
          if (!data || data.length < 2) return null;
          const prevPrice = Number(data[1].price);
          if (prevPrice >= effectivePeg(slug) * 0.975) return null;
          return [slug, price] as [string, number];
        })
    );
    const recovered = recoveryResults.filter(Boolean) as [string, number][];

    // Caution detection — newly entered the 1–2.5% below-peg zone
    const cautionResults = await Promise.all(
      Object.entries(prices)
        .filter((e): e is [string, number] => {
          if (e[1] === null) return false;
          const peg = effectivePeg(e[0]);
          return e[1] >= peg * 0.975 && e[1] < peg * 0.99;
        })
        .map(async ([slug, price]) => {
          if (!seasonedSlugs.has(slug)) return null; // < 30 days of history — skip
          const { data } = await supabase
            .from("price_history")
            .select("price")
            .eq("slug", slug)
            .order("created_at", { ascending: false })
            .limit(2);
          if (!data || data.length < 2) return null;
          const prevPrice = Number(data[1].price);
          const peg = effectivePeg(slug);
          if (prevPrice >= peg * 0.975 && prevPrice < peg * 0.99) return null;
          if (EXCLUDED_FROM_ALERTS.includes(slug)) return null;
          return [slug, price] as [string, number];
        })
    );
    const cautioned = cautionResults.filter(Boolean) as [string, number][];

    // Fire webhooks for all event types (runs regardless of email eligibility)
    await Promise.allSettled([
      ...depegged.map(([slug, price]) =>
        fireWebhooks(supabase, "depeg", slug, price, effectivePeg(slug))
      ),
      ...cautioned.map(([slug, price]) =>
        fireWebhooks(supabase, "caution", slug, price, effectivePeg(slug))
      ),
      ...recovered.map(([slug, price]) =>
        fireWebhooks(supabase, "recovery", slug, price, effectivePeg(slug))
      ),
    ]);

    // Log confirmed depegs on-chain via Sepolia smart contract
    if (depegged.length > 0) {
      const sepoliaRpc = process.env.SEPOLIA_RPC_URL ?? "";
      const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
      if (sepoliaRpc && deployerKey) {
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(sepoliaRpc);
          const wallet = new ethers.Wallet(deployerKey, provider);
          const abi = ["function logDepegEvent(string symbol, uint256 price, string severity) external"];
          const contract = new ethers.Contract("0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa", abi, wallet);
          await Promise.allSettled(
            depegged.map(async ([slug, p]) => {
              try {
                const priceUint = BigInt(Math.round(p * 1e8));
                const tx = await contract.logDepegEvent(slug.toUpperCase(), priceUint, "depegged");
                await tx.wait();
                console.log(`On-chain depeg logged for ${slug}: tx ${tx.hash}`);
              } catch (e) {
                console.error(`Failed to log on-chain depeg for ${slug}:`, e);
              }
            })
          );
        } catch (e) {
          console.error("Failed to initialise ethers for on-chain logging:", e);
        }
      }
    }

    if (depegged.length === 0) {
      return NextResponse.json({
        message: "All stable, no alerts needed",
        chainlink_por: { tusd: porResults["tusd"] ?? null },
      });
    }

    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("email, unsubscribe_token")
      .eq("tier", "premium")
      .eq("alerts_enabled", true);

    if (subError || !subscribers || subscribers.length === 0) {
      return NextResponse.json({ message: "No premium subscribers to alert" });
    }

    const depegList = depegged.map(([slug, price]) => `<li><strong>${coinNames[slug]}</strong> — $${price.toFixed(4)}</li>`).join("");
    const alertBaseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pegcheck.uk";

    for (const subscriber of subscribers) {
      const unsubscribeUrl = subscriber.unsubscribe_token
        ? `${alertBaseUrl}/api/unsubscribe?token=${subscriber.unsubscribe_token}`
        : `${alertBaseUrl}/api/unsubscribe`;

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
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; margin-bottom: 0;">PegCheck premium alert. Not financial advice. <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a></p>
        </div>
      </div>
    `;

      await resend.emails.send({
        from: "PegCheck <alerts@fintechcheck.uk>",
        to: subscriber.email,
        subject: `PegCheck — Stablecoin price alert`,
        html: emailHtml,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    }

    return NextResponse.json({
      message: `Snapshots saved. Alerts sent to ${subscribers.length} premium subscribers.`,
      chainlink_por: {
        tusd: porResults["tusd"] ?? null,
      },
    });

  } catch (error) {
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

// ─── Webhook helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fireWebhooks(
  db: any,
  event: "depeg" | "caution" | "recovery",
  slug: string,
  price: number,
  peg: number
): Promise<void> {
  const { data: hooks } = await db
    .from("webhooks")
    .select("id, url")
    .eq("active", true)
    .contains("events", [event]);

  if (!hooks || hooks.length === 0) return;

  const payload = {
    event,
    coin: slug,
    price,
    peg,
    deviation_pct: parseFloat((((price - peg) / peg) * 100).toFixed(4)),
    triggered_at: new Date().toISOString(),
  };

  await Promise.allSettled(
    hooks.map(async (wh: { id: number; url: string }) => {
      try {
        const res = await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          await db
            .from("webhooks")
            .update({ last_fired: new Date().toISOString(), fail_count: 0 })
            .eq("id", wh.id);
        } else {
          await incrementFailCount(db, wh.id);
        }
      } catch {
        await incrementFailCount(db, wh.id);
      }
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function incrementFailCount(db: any, id: number): Promise<void> {
  const { data } = await db.from("webhooks").select("fail_count").eq("id", id).single();
  const newCount = (data?.fail_count ?? 0) + 1;
  await db
    .from("webhooks")
    .update({ fail_count: newCount, ...(newCount >= 3 ? { active: false } : {}) })
    .eq("id", id);
}