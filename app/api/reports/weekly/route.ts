import { NextResponse } from "next/server";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

const COIN_NAMES: Record<string, string> = {
  usdt:   "USDT",   usdc:   "USDC",   usds:   "USDS",
  ethena: "USDe",   pyusd:  "PYUSD",  fdusd:  "FDUSD",
  rlusd:  "RLUSD",  tusd:   "TUSD",   frax:   "FRAX",
  gho:    "GHO",    crvusd: "crvUSD", lusd:   "LUSD",
  usdp:   "USDP",   usdd:   "USDD",   mkusd:  "mkUSD",
  eurc:   "EURC",   dola:   "DOLA",   alusd:  "alUSD",
  bold:   "BOLD",
};

const COIN_ISSUERS: Record<string, string> = {
  usdt:   "Tether",         usdc:   "Circle",        usds:   "MakerDAO",
  ethena: "Ethena Labs",    pyusd:  "PayPal",         fdusd:  "First Digital",
  rlusd:  "Ripple",         tusd:   "TrueUSD",        frax:   "Frax Finance",
  gho:    "Aave",           crvusd: "Curve Finance",  lusd:   "Liquity",
  usdp:   "Paxos",          usdd:   "TRON DAO",       mkusd:  "Prisma Finance",
  eurc:   "Circle",         dola:   "Inverse Finance", alusd: "Alchemix",
  bold:   "Liquity V2",
};

interface CoinStats {
  slug: string; name: string; issuer: string;
  currentPrice: number; peg: number;
  high7d: number; low7d: number;
  stabilityPct: number; trend: "up" | "stable" | "down";
  status: "Healthy" | "Caution" | "Depeg";
  dataPoints: number;
}

interface WhaleRow {
  slug: string; amount: number; action: string; created_at: string;
}

interface WhaleStats {
  count: number;
  totalVolume: number;
  top3: WhaleRow[];
}

function getStatus(price: number, slug: string): "Healthy" | "Caution" | "Depeg" {
  const peg = COIN_PEGS[slug] ?? 1.0;
  const { healthy, caution } = getThresholds(slug);
  const diff = Math.abs(price - peg) / peg;
  if (diff <= healthy) return "Healthy";
  if (diff <= caution) return "Caution";
  return "Depeg";
}

function weekLabel(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function trendArrow(t: "up" | "stable" | "down"): string {
  return t === "up" ? "↑" : t === "down" ? "↓" : "→";
}

function trendColor(t: "up" | "stable" | "down"): string {
  return t === "up" ? "#10b981" : t === "down" ? "#ef4444" : "#6b7280";
}

function statusBadgeStyle(s: string): string {
  if (s === "Healthy") return "background:#052e16;color:#86efac;border:1px solid rgba(34,197,94,.3)";
  if (s === "Caution") return "background:#2d1f00;color:#fcd34d;border:1px solid rgba(234,179,8,.3)";
  return "background:#2d0a0a;color:#fca5a5;border:1px solid rgba(239,68,68,.3)";
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function buildHtml(coins: CoinStats[], whale: WhaleStats, weekOf: string, marketScore: number): string {
  const healthyCoins = coins.filter(c => c.status === "Healthy");
  const cautionCoins = coins.filter(c => c.status === "Caution");
  const depegCoins   = coins.filter(c => c.status === "Depeg");
  const riskCoins    = coins.filter(c => c.status !== "Healthy").sort((a, b) => a.stabilityPct - b.stabilityPct);

  const marketHealth = marketScore >= 80 ? "Healthy" : marketScore >= 65 ? "Moderate" : "Elevated Risk";
  const marketColor  = marketScore >= 85 ? "#10b981" : marketScore >= 65 ? "#f59e0b" : "#ef4444";

  const coinRows = coins.map(c => {
    const devBps = Math.round(((c.currentPrice - c.peg) / c.peg) * 10000);
    const devStr = devBps === 0 ? "±0" : (devBps > 0 ? `+${devBps}` : `${devBps}`);
    const devColor = devBps < -50 ? "#ef4444" : devBps < -10 ? "#f59e0b" : "#10b981";
    return `
      <tr style="border-bottom:1px solid #1e2a40">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#f9fafb">${c.name}</td>
        <td style="padding:9px 12px;font-size:12px;color:#9ca3af">${c.issuer}</td>
        <td style="padding:9px 12px;font-family:monospace;font-size:12px;color:#f9fafb">$${c.currentPrice.toFixed(4)}</td>
        <td style="padding:9px 12px;font-family:monospace;font-size:11px;color:${devColor}">${devStr} bps</td>
        <td style="padding:9px 12px;font-family:monospace;font-size:13px;font-weight:700;color:${trendColor(c.trend)}">${trendArrow(c.trend)}</td>
        <td style="padding:9px 12px;font-family:monospace;font-size:11px;color:#6b7280">${c.low7d.toFixed(4)}–${c.high7d.toFixed(4)}</td>
        <td style="padding:9px 8px">
          <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;${statusBadgeStyle(c.status)}">${c.status.toUpperCase()}</span>
        </td>
        <td style="padding:9px 12px;font-family:monospace;font-size:11px;color:#6b7280">${c.stabilityPct.toFixed(0)}%</td>
      </tr>`;
  }).join("");

  const riskSection = riskCoins.length === 0
    ? `<p style="color:#6b7280;font-size:13px;margin:0">No coins showed significant stress this week. All 19 tracked stablecoins remained in healthy or near-healthy ranges.</p>`
    : riskCoins.map(c => `
        <div style="padding:12px 16px;background:#12192b;border-radius:8px;border-left:3px solid ${c.status === "Depeg" ? "#ef4444" : "#f59e0b"};margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:14px;font-weight:700;color:#f9fafb">${c.name} <span style="font-size:11px;color:#6b7280;font-weight:400">${c.issuer}</span></span>
            <span style="font-size:12px;font-family:monospace;font-weight:700;color:${c.status === "Depeg" ? "#fca5a5" : "#fcd34d"}">${c.status}</span>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af">
            Current <strong style="color:#f9fafb">$${c.currentPrice.toFixed(4)}</strong> ·
            7d low <strong style="color:#fca5a5">$${c.low7d.toFixed(4)}</strong> ·
            Stability <strong style="color:#f9fafb">${c.stabilityPct.toFixed(0)}%</strong>
          </div>
        </div>`).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FintechCheck Weekly Report</title></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a">
<tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1a56db,#0e3fa8);border-radius:12px 12px 0 0;padding:28px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="display:inline-block;width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:10px;text-align:center;line-height:40px;font-size:16px;font-weight:800;color:white;vertical-align:middle">P✓</div>
          <span style="font-size:18px;font-weight:800;color:white;margin-left:12px;vertical-align:middle">FintechCheck</span>
        </td>
        <td align="right">
          <span style="font-size:11px;color:rgba(255,255,255,.6);font-family:monospace">WEEKLY REPORT</span>
        </td>
      </tr>
      <tr><td colspan="2" style="padding-top:16px">
        <div style="font-size:22px;font-weight:700;color:white">Weekly Stablecoin Risk Report</div>
        <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">Week of ${weekOf} · 19 Stablecoins Monitored</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Executive Summary -->
  <tr><td style="background:#0d1628;padding:24px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">Executive Summary</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="text-align:center;padding:16px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:32px;font-weight:800;color:${marketColor};font-family:monospace">${marketScore}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Market Score</div>
          <div style="font-size:12px;font-weight:700;color:${marketColor};margin-top:2px">${marketHealth}</div>
        </td>
        <td width="4%"></td>
        <td width="63%" style="vertical-align:top">
          <p style="margin:0 0 10px;font-size:13px;color:#9ca3af;line-height:1.6">
            ${depegCoins.length === 0 && cautionCoins.length === 0
              ? "All 19 tracked stablecoins maintained healthy peg proximity this week. No significant deviations detected across any monitored protocol."
              : depegCoins.length > 0
              ? `This week saw ${depegCoins.length} coin${depegCoins.length > 1 ? "s" : ""} fall into depeg territory: <strong style="color:#fca5a5">${depegCoins.map(c => c.name).join(", ")}</strong>. ${cautionCoins.length > 0 ? `A further ${cautionCoins.length} showed caution signals.` : ""}`
              : `${cautionCoins.length} coin${cautionCoins.length > 1 ? "s" : ""} entered caution zones this week: <strong style="color:#fcd34d">${cautionCoins.map(c => c.name).join(", ")}</strong>. No full depegs detected.`
            }
          </p>
          <p style="margin:0;font-size:12px;color:#4b5563">
            ${whale.count} large on-chain transfers (≥$1M) tracked this week.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Traffic Lights -->
  <tr><td style="background:#0d1628;padding:0 32px 20px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="32%" style="text-align:center;padding:14px;background:#052e16;border-radius:8px;border:1px solid rgba(34,197,94,.2)">
          <div style="font-size:28px;font-weight:800;color:#10b981;font-family:monospace">${healthyCoins.length}</div>
          <div style="font-size:11px;font-weight:700;color:#10b981;margin-top:2px">● HEALTHY</div>
        </td>
        <td width="4%"></td>
        <td width="32%" style="text-align:center;padding:14px;background:#2d1f00;border-radius:8px;border:1px solid rgba(234,179,8,.2)">
          <div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:monospace">${cautionCoins.length}</div>
          <div style="font-size:11px;font-weight:700;color:#f59e0b;margin-top:2px">▲ CAUTION</div>
        </td>
        <td width="4%"></td>
        <td width="28%" style="text-align:center;padding:14px;background:#2d0a0a;border-radius:8px;border:1px solid rgba(239,68,68,.2)">
          <div style="font-size:28px;font-weight:800;color:#ef4444;font-family:monospace">${depegCoins.length}</div>
          <div style="font-size:11px;font-weight:700;color:#ef4444;margin-top:2px">⚠ DEPEG</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Top Risks -->
  <tr><td style="background:#0d1628;padding:20px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40;border-top:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Top Risks This Week</div>
    ${riskSection}
  </td></tr>

  <!-- Full Coin Table -->
  <tr><td style="background:#0d1628;padding:20px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40;border-top:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">All 19 Stablecoins</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #1e2a40">
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">COIN</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">ISSUER</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">PRICE</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">DEV</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">7D</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">RANGE</th>
          <th style="text-align:left;padding:6px 8px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">STATUS</th>
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">STAB</th>
        </tr>
      </thead>
      <tbody>${coinRows}</tbody>
    </table>
  </td></tr>

  <!-- Whale Activity -->
  <tr><td style="background:#0d1628;padding:20px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40;border-top:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Whale Activity</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        <td width="48%" style="text-align:center;padding:16px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:32px;font-weight:800;color:#3b82f6;font-family:monospace">${whale.count}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Large Transfers</div>
          <div style="font-size:10px;color:#4b5563;margin-top:2px">≥$1M · Last 7 days</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="text-align:center;padding:16px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:32px;font-weight:800;color:#8b5cf6;font-family:monospace">${fmtVolume(whale.totalVolume)}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Total Volume</div>
          <div style="font-size:10px;color:#4b5563;margin-top:2px">USD moved on-chain</div>
        </td>
      </tr>
    </table>
    ${whale.count === 0
      ? `<p style="margin:0;font-size:13px;color:#6b7280">No transfers ≥$1M detected this week across monitored stablecoin contracts.</p>`
      : `<div style="font-size:11px;font-weight:700;color:#4b5563;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Top Transfers</div>
         ${whale.top3.map((tx, i) => {
           const coinName = COIN_NAMES[tx.slug] ?? tx.slug.toUpperCase();
           const actionColor = tx.action === "mint" ? "#10b981" : tx.action === "burn" ? "#ef4444" : "#3b82f6";
           const actionLabel = tx.action.replace("_", " ").toUpperCase();
           const date = new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
           return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0a0e1a;border-radius:7px;border:1px solid #1e2a40;margin-bottom:6px">
             <div>
               <span style="font-size:13px;font-weight:700;color:#f9fafb">${coinName}</span>
               <span style="margin-left:8px;font-size:10px;font-weight:700;color:${actionColor};background:${actionColor}22;padding:2px 6px;border-radius:3px">${actionLabel}</span>
             </div>
             <div style="text-align:right">
               <div style="font-size:13px;font-weight:700;color:#f9fafb;font-family:monospace">${fmtVolume(tx.amount)}</div>
               <div style="font-size:11px;color:#4b5563">${date}</div>
             </div>
           </div>`;
         }).join("")}`
    }
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#080c16;border:1px solid #1e2a40;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:13px;font-weight:700;color:#374151">
            <span style="color:#1a56db">P✓</span> Powered by FintechCheck
          </div>
          <div style="font-size:11px;color:#4b5563;margin-top:3px">
            Real-time stablecoin monitoring · 7 independent sources · 19 coins tracked
          </div>
          <a href="https://pegcheck.uk" style="font-size:12px;color:#1a56db;text-decoration:none;margin-top:6px;display:inline-block">pegcheck.uk →</a>
        </td>
        <td align="right" style="vertical-align:top">
          <div style="font-size:10px;color:#374151;margin-bottom:4px">Not financial advice</div>
          <a href="https://pegcheck.uk" style="font-size:11px;color:#4b5563;text-decoration:underline">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const body = await request.json().catch(() => ({}));
    const to: string = body.to ?? "mat@fintechcheck.uk";
    const sendType: string = body.type ?? "manual";

    if (!to.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso = since.toISOString();

    // Fetch 7-day price history for all slugs
    const { data: history } = await supabase
      .from("price_history")
      .select("slug, price, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true });

    // Fetch whale transfers ≥$1M for last 7 days using service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'Prefer': 'count=exact' } },
      }
    );

    const { data: whaleRows, count: whaleCount, error: whaleError } = await supabaseAdmin
      .from("large_transactions")
      .select("slug, amount, action, created_at, tx_hash, wallet", { count: 'exact' })
      .gte("created_at", sinceIso)
      .gte("amount", 1000000)
      .order("amount", { ascending: false })
      .limit(10000);

    if (whaleError) {
      console.error("Whale query error:", JSON.stringify(whaleError));
    }
    console.log("Whale rows returned:", whaleRows?.length ?? 0, "exact count:", whaleCount, whaleError ? `error: ${whaleError.message}` : "");

    const whaleData = whaleRows ?? [];
    const whale: WhaleStats = {
      count: whaleCount ?? whaleData.length,
      totalVolume: whaleData.reduce((s, r) => s + Number(r.amount), 0),
      top3: whaleData.slice(0, 3),
    };

    // Group history by slug
    const bySlug: Record<string, number[]> = {};
    for (const row of history ?? []) {
      if (!bySlug[row.slug]) bySlug[row.slug] = [];
      bySlug[row.slug].push(Number(row.price));
    }

    const weekOf = weekLabel();
    const slugs = Object.keys(COIN_NAMES);
    let totalStability = 0;

    const coins: CoinStats[] = slugs.map(slug => {
      const prices  = bySlug[slug] ?? [];
      const peg     = COIN_PEGS[slug] ?? 1.0;
      const { healthy } = getThresholds(slug);

      const currentPrice = prices.length > 0 ? prices[prices.length - 1] : peg;
      const high7d  = prices.length > 0 ? Math.max(...prices) : peg;
      const low7d   = prices.length > 0 ? Math.min(...prices) : peg;

      // Stability: % of readings within healthy band
      const stabilityPct = prices.length > 0
        ? (prices.filter(p => Math.abs(p - peg) / peg <= healthy).length / prices.length) * 100
        : 100;

      // Trend: compare avg deviation first half vs second half
      let trend: "up" | "stable" | "down" = "stable";
      if (prices.length >= 6) {
        const half = Math.floor(prices.length / 2);
        const early = prices.slice(0, half).reduce((s, p) => s + Math.abs(p - peg), 0) / half;
        const recent = prices.slice(-half).reduce((s, p) => s + Math.abs(p - peg), 0) / half;
        if (recent < early * 0.9) trend = "up";
        else if (recent > early * 1.1) trend = "down";
      }

      totalStability += stabilityPct;
      return {
        slug, peg, currentPrice, high7d, low7d, stabilityPct, trend,
        name: COIN_NAMES[slug], issuer: COIN_ISSUERS[slug],
        status: getStatus(currentPrice, slug),
        dataPoints: prices.length,
      };
    });

    const marketScore = Math.round(totalStability / slugs.length);
    const html = buildHtml(coins, whale, weekOf, marketScore);

    const depegList = coins.filter(c => c.status === "Depeg").map(c => c.name);
    const subjectSuffix = depegList.length > 0
      ? ` — ⚠ ${depegList.join(", ")} in depeg`
      : " — All systems healthy";

    await resend.emails.send({
      from: "FintechCheck <alerts@fintechcheck.uk>",
      to,
      subject: `FintechCheck Weekly Report · ${weekOf}${subjectSuffix}`,
      html,
    });

    // Log send to report_sends table
    const { error: logError } = await supabaseAdmin
      .from("report_sends")
      .insert({ email: to, report_date: new Date().toISOString().split("T")[0], type: sendType });
    if (logError) console.error("report_sends log error:", logError.message);

    return NextResponse.json({
      success: true,
      sentTo: to,
      marketScore,
      coinsWithData: coins.filter(c => c.dataPoints > 0).length,
      whaleTransfers: whale.count,
      whaleTotalVolume: whale.totalVolume,
      ...(whaleError ? { whaleQueryError: whaleError.message } : {}),
    });

  } catch (err) {
    console.error("Weekly report error:", err);
    return NextResponse.json({ error: "Failed to generate or send report" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await supabase
      .from("report_sends")
      .select("email, report_date, type, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ sends: [], error: error.message });
    return NextResponse.json({ sends: data ?? [] });
  } catch (err) {
    console.error("report_sends GET error:", err);
    return NextResponse.json({ sends: [], error: "Failed to fetch sends" });
  }
}
