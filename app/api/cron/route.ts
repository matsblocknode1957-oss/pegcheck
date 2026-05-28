import { NextResponse } from "next/server";
import { COIN_PEGS } from "@/lib/coinPegs";
import { fetchEurUsd } from "@/lib/fetchEurUsd";

// Temporarily excluded from alerts — persistent depeg, remove when recovered
const EXCLUDED_FROM_ALERTS = ["frax", "dola", "alusd"];

function median(values: number[]): number {
  const sorted = values.filter(v => v > 0.5 && v < 1.5).sort((a, b) => a - b);
  if (sorted.length === 0) return 1.0;
  if (sorted.length === 1) return sorted[0];
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Chainlink price feed contracts (Ethereum Mainnet, 8 decimals)
const CHAINLINK_FEEDS: Record<string, string> = {
  usdt: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  usdc: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  usds: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  tusd: "0xec746eCF986E2927Abd291a2A1716c940100f8Ba",
};

// Chainlink Proof of Reserve feed contracts (Ethereum Mainnet, 8 decimals)
const POR_FEEDS: Record<string, string> = {
  tusd: "0xBE456fd14720C3aCCc30A2013Bffd782c9Cb75D5",
};

async function callLatestRoundData(contract: string, rpcUrl: string): Promise<string | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: contract, data: "0xfeaf968c" }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  if (!json.result || json.result === "0x") return null;
  return json.result;
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
    const result = await callLatestRoundData(contract, rpcUrl);
    if (!result) return null;
    const hex = result.slice(2);
    // ABI slot 1 — int256 answer (reserves, 8 decimals)
    const reserves = Number(BigInt("0x" + hex.slice(64, 128))) / 1e8;
    // ABI slot 3 — uint256 updatedAt
    const updatedAt = Number(BigInt("0x" + hex.slice(192, 256)));
    return { reserves, updated_at: new Date(updatedAt * 1000).toISOString() };
  } catch {
    return null;
  }
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

    const eurUsd = await fetchEurUsd();
    const effectivePeg = (slug: string) => slug === "eurc" ? eurUsd : (COIN_PEGS[slug] ?? 1.0);

    // CoinGecko
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,dai,ethena-usde,paypal-usd,first-digital-usd,ripple-usd,true-usd,frax,gho,crvusd,liquity-usd,paxos-standard,usdd,prisma-mkusd,euro-coin,dola-usd,alchemix-usd,bold&vs_currencies=usd"
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

    // DefiLlama
    const dlRes = await fetch("https://stablecoins.llama.fi/stablecoins?includePrices=true");
    const dlData = await dlRes.json();
    const dlCoins = dlData?.peggedAssets ?? [];
    const dlResults: Record<string, number> = {};
    dlCoins.forEach((coin: { symbol: string; price: number }) => {
      dlResults[coin.symbol.toLowerCase()] = coin.price ?? 0;
    });

    // Chainlink on-chain price feeds
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

    // Chainlink Proof of Reserve feeds
    const porResults: Record<string, { reserves: number; updated_at: string } | null> = {};
    if (rpcUrl) {
      await Promise.allSettled(
        Object.entries(POR_FEEDS).map(async ([slug, contract]) => {
          porResults[slug] = await fetchChainlinkPoR(contract, rpcUrl);
        })
      );
    }

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
    const prices: Record<string, number> = {
      usdt:   median([cgData["tether"]?.usd ?? 0,        cbResults["USDT-USD"] ?? 0,                                  krResults["usdt"]  ?? 0, dlResults["usdt"]  ?? 0, clResults["usdt"]  ?? 0]),
      usdc:   median([cgData["usd-coin"]?.usd ?? 0,      cbResults["USDC-USD"] ?? 0,  bnResults["usdc"]  ?? 0,        krResults["usdc"]  ?? 0, dlResults["usdc"]  ?? 0, clResults["usdc"]  ?? 0]),
      usds:   median([cgData["dai"]?.usd ?? 0,           cbResults["DAI-USD"] ?? 0,   bnResults["usds"]  ?? 0,        krResults["usds"]  ?? 0, dlResults["dai"]   ?? 0, clResults["usds"]  ?? 0]),
      ethena: median([cgData["ethena-usde"]?.usd ?? 0,                                                                                           dlResults["usde"]  ?? 0]),
      pyusd:  median([cgData["paypal-usd"]?.usd ?? 0,    cbResults["PYUSD-USD"] ?? 0, bnResults["pyusd"] ?? 0,        krResults["pyusd"] ?? 0, dlResults["pyusd"] ?? 0, clResults["pyusd"] ?? 0]),
      fdusd:  median([cgData["first-digital-usd"]?.usd ?? 0,                                                                                     dlResults["fdusd"] ?? 0]),
      rlusd:  median([cgData["ripple-usd"]?.usd ?? 0,                                                                                            dlResults["rlusd"] ?? 0]),
      tusd:   median([cgData["true-usd"]?.usd ?? 0,      cbResults["TUSD-USD"] ?? 0,  bnResults["tusd"]  ?? 0,        krResults["tusd"]  ?? 0, dlResults["tusd"]  ?? 0, clResults["tusd"]  ?? 0]),
      frax:   median([cgData["frax"]?.usd          ?? 0, dlResults["frax"]   ?? 0]),
      gho:    median([cgData["gho"]?.usd           ?? 0, dlResults["gho"]    ?? 0]),
      crvusd: median([cgData["crvusd"]?.usd        ?? 0, dlResults["crvusd"] ?? 0]),
      lusd:   median([cgData["liquity-usd"]?.usd   ?? 0, dlResults["lusd"]   ?? 0]),
      usdp:   median([cgData["paxos-standard"]?.usd ?? 0, dlResults["usdp"]  ?? 0]),
      usdd:   median([cgData["usdd"]?.usd          ?? 0, dlResults["usdd"]   ?? 0]),
      mkusd:  median([cgData["prisma-mkusd"]?.usd  ?? 0, dlResults["mkusd"]  ?? 0]),
      eurc:   median([cgData["euro-coin"]?.usd     ?? 0, dlResults["eurc"]   ?? 0]),
      dola:   median([cgData["dola-usd"]?.usd      ?? 0, dlResults["dola"]   ?? 0]),
      alusd:  median([cgData["alchemix-usd"]?.usd  ?? 0, dlResults["alusd"]  ?? 0]),
      bold:   median([cgData["bold"]?.usd          ?? 0, dlResults["bold"]   ?? 0]),
    };

    const coinNames: Record<string, string> = {
      usdt: "USDT (Tether)",
      usdc: "USDC (Circle)",
      usds: "USDS (MakerDAO)",
      ethena: "Ethena",
      pyusd: "PYUSD (PayPal)",
      fdusd: "FDUSD (First Digital)",
      rlusd: "RLUSD (Ripple)",
      tusd:   "TUSD (TrueUSD)",
      frax:   "FRAX (Frax Finance)",
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
    };

    // Save Price Snapshot
    const snapshots = Object.entries(prices).map(([slug, price]) => ({
      slug,
      price,
      deviation_bps: Math.round((price - effectivePeg(slug)) / effectivePeg(slug) * 10000),
    }));
    const { error: priceError } = await supabase.from("price_history").insert(snapshots);
    if (priceError) console.error("Price history insert error:", priceError);
    else console.log("Price history saved:", snapshots.length, "rows");

    // Check for Depegs — only alert if coin has ≥2 history records AND wasn't already depegged last cycle
    const currentlyDepegged = Object.entries(prices).filter(([slug, price]) => price < effectivePeg(slug) * 0.975);

    const depegChecks = await Promise.all(
      currentlyDepegged.map(async ([slug]) => {
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
        .filter(([slug, price]) => price >= effectivePeg(slug) * 0.975)
        .map(async ([slug]) => {
          const { data } = await supabase
            .from("price_history")
            .select("price")
            .eq("slug", slug)
            .order("created_at", { ascending: false })
            .limit(2);
          if (!data || data.length < 2) return null;
          const prevPrice = Number(data[1].price);
          if (prevPrice >= effectivePeg(slug) * 0.975) return null;
          return [slug, prices[slug]] as [string, number];
        })
    );
    const recovered = recoveryResults.filter(Boolean) as [string, number][];

    // Caution detection — newly entered the 1–2.5% below-peg zone
    const cautionResults = await Promise.all(
      Object.entries(prices)
        .filter(([slug, price]) => {
          const peg = effectivePeg(slug);
          return price >= peg * 0.975 && price < peg * 0.99;
        })
        .map(async ([slug]) => {
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
          return [slug, prices[slug]] as [string, number];
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
        from: "PegCheck <alerts@fintechcheck.uk>",
        to: subscriber.email,
        subject: `PegCheck — Stablecoin price alert`,
        html: emailHtml,
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