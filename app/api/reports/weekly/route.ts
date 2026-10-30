import { NextResponse } from "next/server";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";
import { fetchEurUsd } from "@/lib/fetchEurUsd";
import { checkAdminAuth, ADMIN_WWW_AUTH } from "@/lib/adminAuth";

const ADMIN_EMAIL = "fintechcheckadmin1@gmail.com";

const COIN_NAMES: Record<string, string> = {
  usdt:   "USDT",   usdc:   "USDC",   dai:    "DAI",    usds:   "USDS",
  ethena: "USDe",   pyusd:  "PYUSD",  fdusd:  "FDUSD",
  rlusd:  "RLUSD",  tusd:   "TUSD",   frax:   "frxUSD",
  gho:    "GHO",    crvusd: "crvUSD", lusd:   "LUSD",
  usdp:   "USDP",   usdd:   "USDD",   mkusd:  "mkUSD",
  eurc:   "EURC",   dola:   "DOLA",   alusd:  "alUSD",
  bold:   "BOLD",   usdg:   "USDG",   usd1:   "USD1",
  u:      "U",      usdgo:  "USDGO",  usdf:   "USDf",
};

const COIN_ISSUERS: Record<string, string> = {
  usdt:   "Tether",           usdc:   "Circle",           dai:    "Sky (MakerDAO)",
  usds:   "Sky",              ethena: "Ethena Labs",       pyusd:  "PayPal",
  fdusd:  "First Digital",    rlusd:  "Ripple",            tusd:   "TrueUSD",
  frax:   "Frax Finance",     gho:    "Aave",              crvusd: "Curve Finance",
  lusd:   "Liquity",          usdp:   "Paxos",             usdd:   "TRON DAO",
  mkusd:  "Prisma Finance",   eurc:   "Circle",            dola:   "Inverse Finance",
  alusd:  "Alchemix",         bold:   "Liquity V2",        usdg:   "Paxos",
  usd1:   "World Liberty Financial", u: "United Stables", usdgo: "Anchorage / OSL",
  usdf:   "Falcon Finance",
};

// Coins that are structurally off-peg and should not trigger a depeg alarm in the subject line.
const CHRONIC_DEPEG = new Set(["alusd"]);

interface PriceStatRow {
  slug:            string;
  latest_price:    number;
  high_7d:         number;
  low_7d:          number;
  reading_count:   number;
  stability_pct:   number;
  trend_direction: string;
}

type CoinStatus = "Healthy" | "Caution" | "Depeg" | "Depeg (ongoing)" | "Above peg";

interface CoinStats {
  slug: string; name: string; issuer: string;
  currentPrice: number; peg: number;
  high7d: number; low7d: number;
  stabilityPct: number; trend: "up" | "stable" | "down";
  status: CoinStatus;
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

interface CoinWhaleStats {
  slug: string;
  name: string;
  count: number;
  totalVolume: number;
}

function getStatus(price: number, slug: string, peg: number, high7d?: number): CoinStatus {
  const { healthy, caution } = getThresholds(slug);
  const signedDiff = (price - peg) / peg;
  const absDiff    = Math.abs(signedDiff);
  if (absDiff <= healthy) return "Healthy";
  if (signedDiff > 0)     return "Above peg";
  if (absDiff <= caution) return "Caution";
  // Ongoing depeg: manual override OR 7-day high still below the caution threshold
  // (meaning the coin never recovered above the depeg line all week)
  const isOngoing = CHRONIC_DEPEG.has(slug) ||
    (high7d !== undefined && high7d < peg * (1 - caution));
  return isOngoing ? "Depeg (ongoing)" : "Depeg";
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

function statusBadgeStyle(s: CoinStatus): string {
  if (s === "Healthy")                         return "background:#052e16;color:#86efac;border:1px solid rgba(34,197,94,.3)";
  if (s === "Caution" || s === "Above peg")    return "background:#2d1f00;color:#fcd34d;border:1px solid rgba(234,179,8,.3)";
  return                                              "background:#2d0a0a;color:#fca5a5;border:1px solid rgba(239,68,68,.3)";
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function buildHtml(
  coins: CoinStats[],
  whale: WhaleStats,
  topCoinsByVolume: CoinWhaleStats[],
  weekOf: string,
  marketScore: number,
  pegScore: number,
  fearGreedScore: number | null,
  maxSources: number,
  unsubscribeUrl: string,
): string {
  const healthyCoins   = coins.filter(c => c.status === "Healthy");
  const abovePegCoins  = coins.filter(c => c.status === "Above peg");
  const cautionCoins   = coins.filter(c => c.status === "Caution");
  const acuteDepeg     = coins.filter(c => c.status === "Depeg");
  const ongoingDepeg   = coins.filter(c => c.status === "Depeg (ongoing)");
  const depegCoins     = [...acuteDepeg, ...ongoingDepeg];
  // Caution pill includes "Above peg" coins (same amber colour, not red)
  const cautionPlusAbove = coins.filter(c => c.status === "Caution" || c.status === "Above peg");
  const riskCoins = coins
    .filter(c => c.status !== "Healthy")
    .sort((a, b) => {
      // Acute depeg first, then ongoing, then above peg, then caution
      const ord = (s: CoinStatus) =>
        s === "Depeg" ? 0 : s === "Depeg (ongoing)" ? 1 : s === "Above peg" ? 2 : 3;
      if (ord(a.status) !== ord(b.status)) return ord(a.status) - ord(b.status);
      return a.stabilityPct - b.stabilityPct;
    });

  const marketHealth = marketScore >= 80 ? "Healthy" : marketScore >= 60 ? "Caution" : marketScore >= 40 ? "Elevated Risk" : "High Risk";
  const marketColor  = marketScore >= 80 ? "#10b981" : marketScore >= 60 ? "#f59e0b" : "#ef4444";
  const pegColor     = pegScore   >= 80 ? "#10b981" : pegScore   >= 60 ? "#f59e0b" : "#ef4444";
  const fgColor      = fearGreedScore === null ? "#6b7280"
    : fearGreedScore <= 24 ? "#ef4444"
    : fearGreedScore <= 49 ? "#ea580c"
    : fearGreedScore <= 55 ? "#6b7280"
    : fearGreedScore <= 74 ? "#10b981"
    : "#15803d";

  // Summary narrative
  const summaryText = (() => {
    const parts: string[] = [];
    if (acuteDepeg.length > 0) {
      parts.push(`${acuteDepeg.length} coin${acuteDepeg.length > 1 ? "s" : ""} in depeg territory: <strong style="color:#fca5a5">${acuteDepeg.map(c => c.name).join(", ")}</strong>.`);
    }
    if (ongoingDepeg.length > 0) {
      parts.push(`${ongoingDepeg.length} coin${ongoingDepeg.length > 1 ? "s" : ""} in ongoing structural depeg: <strong style="color:#fca5a5">${ongoingDepeg.map(c => c.name).join(", ")}</strong>.`);
    }
    if (abovePegCoins.length > 0) {
      parts.push(`${abovePegCoins.length} coin${abovePegCoins.length > 1 ? "s" : ""} trading above peg: <strong style="color:#fcd34d">${abovePegCoins.map(c => c.name).join(", ")}</strong>.`);
    }
    if (cautionCoins.length > 0) {
      parts.push(`${cautionCoins.length} in caution: <strong style="color:#fcd34d">${cautionCoins.map(c => c.name).join(", ")}</strong>.`);
    }
    if (parts.length === 0) {
      return `All ${coins.length} tracked stablecoins maintained healthy peg proximity this week. No significant deviations detected across any monitored protocol.`;
    }
    return parts.join(" ");
  })();

  const coinRows = coins.map(c => {
    const signedBps = Math.round(((c.currentPrice - c.peg) / c.peg) * 10000);
    const devStr    = signedBps === 0 ? "±0" : (signedBps > 0 ? `+${signedBps}` : `${signedBps}`);
    const absBps    = Math.abs(signedBps);
    const { healthy: hFrac, caution: cFrac } = getThresholds(c.slug);
    const hBps = Math.round(hFrac * 10000);
    const cBps = Math.round(cFrac * 10000);
    const devColor = absBps > cBps ? "#ef4444"
      : (c.status === "Above peg" || absBps > hBps) ? "#f59e0b"
      : "#10b981";
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
    ? `<p style="color:#6b7280;font-size:13px;margin:0">No coins showed significant stress this week. All ${coins.length} tracked stablecoins remained in healthy or near-healthy ranges.</p>`
    : riskCoins.map(c => {
        const isRed       = c.status === "Depeg" || c.status === "Depeg (ongoing)";
        const borderColor = isRed ? "#ef4444" : "#f59e0b";
        const labelColor  = isRed ? "#fca5a5" : "#fcd34d";
        const rangeLabel  = c.status === "Above peg"
          ? `7d high <strong style="color:#fcd34d">$${c.high7d.toFixed(4)}</strong>`
          : `7d low <strong style="color:#fca5a5">$${c.low7d.toFixed(4)}</strong>`;
        return `
        <div style="padding:12px 16px;background:#12192b;border-radius:8px;border-left:3px solid ${borderColor};margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:14px;font-weight:700;color:#f9fafb">${c.name} <span style="font-size:11px;color:#6b7280;font-weight:400">${c.issuer}</span></span>
            <span style="font-size:12px;font-family:monospace;font-weight:700;color:${labelColor}">${c.status}</span>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af">
            Current <strong style="color:#f9fafb">$${c.currentPrice.toFixed(4)}</strong> ·
            ${rangeLabel} ·
            Near peg <strong style="color:#f9fafb">${c.stabilityPct.toFixed(0)}%</strong>
          </div>
        </div>`;
      }).join("");

  const fgLabel = fearGreedScore === null ? "N/A"
    : fearGreedScore <= 24 ? "Extreme Fear"
    : fearGreedScore <= 49 ? "Fear"
    : fearGreedScore <= 55 ? "Neutral"
    : fearGreedScore <= 74 ? "Greed"
    : "Extreme Greed";

  const hiNote = fearGreedScore !== null
    ? `50% peg&nbsp;+&nbsp;50% F&amp;G`
    : `Peg score only`;

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
        <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">Week of ${weekOf} · ${coins.length} Stablecoins Monitored</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Executive Summary -->
  <tr><td style="background:#0d1628;padding:24px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">Executive Summary</div>
    <!-- Three metric boxes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        <td width="30%" style="text-align:center;padding:14px 10px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:26px;font-weight:800;color:${pegColor};font-family:monospace;line-height:1">${pegScore}</div>
          <div style="font-size:9px;color:#6b7280;margin-top:5px;text-transform:uppercase;letter-spacing:1px">Peg Score</div>
          <div style="font-size:10px;color:#4b5563;margin-top:2px">Price deviation</div>
        </td>
        <td width="4%"></td>
        <td width="30%" style="text-align:center;padding:14px 10px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:26px;font-weight:800;color:${fgColor};font-family:monospace;line-height:1">${fearGreedScore ?? "N/A"}</div>
          <div style="font-size:9px;color:#6b7280;margin-top:5px;text-transform:uppercase;letter-spacing:1px">Fear &amp; Greed</div>
          <div style="font-size:10px;color:#4b5563;margin-top:2px">${fearGreedScore !== null ? fgLabel : "Unavailable"}</div>
        </td>
        <td width="4%"></td>
        <td width="32%" style="text-align:center;padding:14px 10px;background:#0a0e1a;border-radius:8px;border:1px solid #1e2a40">
          <div style="font-size:26px;font-weight:800;color:${marketColor};font-family:monospace;line-height:1">${marketScore}</div>
          <div style="font-size:9px;color:#6b7280;margin-top:5px;text-transform:uppercase;letter-spacing:1px">Health Index</div>
          <div style="font-size:10px;color:#4b5563;margin-top:2px">${hiNote}</div>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">${summaryText}</p>
    <p style="margin:8px 0 0;font-size:12px;color:#4b5563">${whale.count} large on-chain transfers (≥$1M) tracked this week.</p>
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
          <div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:monospace">${cautionPlusAbove.length}</div>
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
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">All ${coins.length} Stablecoins</div>
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
          <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">NEAR PEG</th>
        </tr>
      </thead>
      <tbody>${coinRows}</tbody>
    </table>
    <p style="margin:12px 0 0;font-size:11px;color:#4b5563">Near peg = % of 7-day readings within the coin&apos;s healthy band (±20 bps fiat-backed · ±30 bps DeFi/synthetic · ±50 bps high-variance). Ranges exclude single-source blips.</p>
  </td></tr>

  <!-- Large transfers spotted -->
  <tr><td style="background:#0d1628;padding:20px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40;border-top:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Large transfers spotted</div>
    <div style="font-size:11px;color:#4b5563;margin-bottom:12px">A sample of $1M+ transfers on Ethereum, not a full count.</div>
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
         ${whale.top3.map((tx) => {
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

  <!-- Coins with large transfers spotted -->
  <tr><td style="background:#0d1628;padding:20px 32px;border-left:1px solid #1e2a40;border-right:1px solid #1e2a40;border-top:1px solid #1e2a40">
    <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Coins with large transfers spotted</div>
    ${topCoinsByVolume.length === 0
      ? `<p style="color:#6b7280;font-size:13px;margin:0">No large transfers recorded this week.</p>`
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid #1e2a40">
              <th style="text-align:left;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">COIN</th>
              <th style="text-align:right;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">TRANSFERS</th>
              <th style="text-align:right;padding:6px 12px;font-size:9px;color:#4b5563;font-weight:700;letter-spacing:1px;text-transform:uppercase">TOTAL VOLUME</th>
            </tr>
          </thead>
          <tbody>
            ${topCoinsByVolume.map((c, i) => `
              <tr style="border-bottom:1px solid #1e2a40">
                <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#f9fafb">
                  <span style="color:#4b5563;font-family:monospace;font-size:11px;margin-right:8px">${i + 1}</span>${c.name}
                </td>
                <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:12px;color:#9ca3af">${c.count.toLocaleString()}</td>
                <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#8b5cf6">${fmtVolume(c.totalVolume)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`
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
            Real-time stablecoin monitoring · up to ${maxSources} price sources · ${coins.length} coins tracked
          </div>
          <a href="https://pegcheck.uk" style="font-size:12px;color:#1a56db;text-decoration:none;margin-top:6px;display:inline-block">pegcheck.uk →</a>
        </td>
        <td align="right" style="vertical-align:top">
          <div style="font-size:10px;color:#374151;margin-bottom:4px">Not financial advice</div>
          <a href="${unsubscribeUrl}" style="font-size:11px;color:#4b5563;text-decoration:underline">Unsubscribe</a>
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

    const body        = await request.json().catch(() => ({}));
    const sendType    = (body.type ?? "manual") as string;
    const isAutomated = sendType === "automated";
    const to          = (body.to ?? ADMIN_EMAIL) as string;
    const unsubscribeToken = (body.unsubscribeToken ?? null) as string | null;

    if (isAutomated) {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        console.error("Weekly report: CRON_SECRET is not set — automated send refused");
        return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
      }
      if (request.headers.get("x-cron-secret") !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!isAutomated) {
      const deny = checkAdminAuth(request.headers.get("authorization"));
      if (deny) {
        return NextResponse.json(
          { error: deny.error },
          { status: deny.status, headers: { "WWW-Authenticate": ADMIN_WWW_AUTH } }
        );
      }
    }

    if (!isAutomated && !to.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const resend   = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const liveEurUsd = await fetchEurUsd().catch(() => null);

    const since    = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso = since.toISOString();

    // ── Fetch all data ─────────────────────────────────────────────────────────
    const { data: priceStats, error: priceError } = await supabase
      .rpc("weekly_price_stats", { since: sinceIso });

    const { data: whaleRows, count: whaleCount, error: whaleError } = await supabase
      .from("large_transactions")
      .select("slug, amount, action, created_at, tx_hash, wallet", { count: "exact" })
      .gte("created_at", sinceIso)
      .gte("amount", 1000000)
      .order("amount", { ascending: false })
      .limit(3);

    const { data: volData, error: volError } = await supabase
      .from("large_transactions")
      .select("amount.sum()")
      .gte("created_at", sinceIso)
      .gte("amount", 1000000)
      .single();

    const { data: coinVolRows, error: coinVolError } = await supabase
      .rpc("whale_volume_by_coin", { since_ts: sinceIso, min_amount: 1000000 });

    // Max source count: query a recent sample of price_history rows
    let maxSources = 6;
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentRows } = await supabase
        .from("price_history")
        .select("source_prices")
        .gte("created_at", twoHoursAgo)
        .not("source_prices", "is", null)
        .limit(150);
      if (recentRows) {
        for (const row of recentRows as { source_prices: Record<string, number> | null }[]) {
          if (row.source_prices && typeof row.source_prices === "object") {
            const cnt = Object.values(row.source_prices).filter(v => v > 0).length;
            if (cnt > maxSources) maxSources = cnt;
          }
        }
      }
    } catch { /* fall back to default */ }

    // ── Price data gate: never send a report built from fallback values ─────────
    const priceRowCount = (priceStats as PriceStatRow[] | null)?.length ?? 0;
    if (priceError || priceRowCount < 20) {
      const reason = priceError
        ? `weekly_price_stats RPC failed: ${priceError.message}`
        : `weekly_price_stats returned ${priceRowCount} rows — minimum 20 required`;
      console.error("Weekly report NOT sent (price data):", reason);
      await resend.emails.send({
        from: "FintechCheck <alerts@fintechcheck.uk>",
        to:   "matsblocknode1957@gmail.com",
        subject: "Weekly report NOT sent: price data missing",
        html: `<div style="font-family:sans-serif;max-width:520px"><p>The weekly stablecoin report was <strong>not sent</strong> to subscribers.</p><pre style="background:#f5f5f5;padding:12px;font-size:12px;white-space:pre-wrap">${reason}</pre><p style="color:#6b7280;font-size:12px">Retrigger: POST /api/reports/weekly</p></div>`,
      }).catch(e => console.error("Price-gate alert email failed:", e));
      return NextResponse.json({ aborted: true, reason, priceRowCount });
    }

    if (whaleError)   console.error("Whale query error:",  JSON.stringify(whaleError));
    if (volError)     console.error("Volume SUM error:",   JSON.stringify(volError));
    if (coinVolError) console.error("Coin vol RPC error:", JSON.stringify(coinVolError));

    // ── Build coins array ──────────────────────────────────────────────────────
    const statsBySlug: Record<string, PriceStatRow> = Object.fromEntries(
      ((priceStats ?? []) as PriceStatRow[]).map(r => [r.slug, r])
    );
    const weekOf = weekLabel();
    const slugs  = Object.keys(COIN_NAMES);

    const coins: CoinStats[] = slugs.map(slug => {
      const row = statsBySlug[slug] as PriceStatRow | undefined;
      const peg = slug === "eurc"
        ? (liveEurUsd ?? COIN_PEGS["eurc"] ?? 1.16)
        : (COIN_PEGS[slug] ?? 1.0);

      const currentPrice = row ? Number(row.latest_price)  : peg;
      const high7d       = row ? Number(row.high_7d)        : peg;
      const low7d        = row ? Number(row.low_7d)         : peg;
      const stabilityPct = row ? Number(row.stability_pct)  : 100;
      const trend        = (row?.trend_direction ?? "stable") as "up" | "stable" | "down";

      return {
        slug, peg, currentPrice, high7d, low7d, stabilityPct, trend,
        name:       COIN_NAMES[slug],
        issuer:     COIN_ISSUERS[slug],
        status:     getStatus(currentPrice, slug, peg, high7d),
        dataPoints: row ? Number(row.reading_count) : 0,
      };
    });

    // ── Sort coins by market cap, largest first ────────────────────────────────
    const marketCapsByCoin: Record<string, number> = {};
    try {
      const { data: mcRows, error: mcError } = await supabase
        .from("price_history")
        .select("slug, market_cap_usd")
        .in("slug", slugs)
        .not("market_cap_usd", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!mcError && mcRows) {
        const seen = new Set<string>();
        for (const row of mcRows as Array<{ slug: string; market_cap_usd: number }>) {
          if (!seen.has(row.slug) && row.market_cap_usd > 0) {
            marketCapsByCoin[row.slug] = row.market_cap_usd;
            seen.add(row.slug);
          }
        }
      }
    } catch { /* column not yet created */ }

    coins.sort((a, b) => {
      const mcA = marketCapsByCoin[a.slug];
      const mcB = marketCapsByCoin[b.slug];
      if (mcA != null && mcB != null) return mcB - mcA;
      if (mcA != null) return -1;
      if (mcB != null) return 1;
      return 0;
    });

    // ── Safety guard ───────────────────────────────────────────────────────────
    const coinsWithData   = coins.filter(c => c.dataPoints > 0).length;
    const coinsWithPrices = coins.filter(c => c.dataPoints > 0);
    const allAtPeg = coinsWithPrices.length > 0 &&
                     coinsWithPrices.every(c => c.currentPrice === c.peg);

    const abortReason: string | null =
      whaleError   ? `large_transactions query failed: ${whaleError.message}` :
      volError     ? `volume SUM query failed: ${volError.message}` :
      coinVolError ? `whale_volume_by_coin RPC failed: ${coinVolError.message}` :
      coinsWithData < Math.floor(slugs.length / 2)
        ? `only ${coinsWithData}/${slugs.length} coins have price data` :
      allAtPeg
        ? `all ${coinsWithPrices.length} coins with data are priced at exactly their peg — possible data fallback` :
      null;

    if (abortReason) {
      console.error("Weekly report aborted:", abortReason);
      const abortDate = new Date().toISOString().slice(0, 10);
      await resend.emails.send({
        from: "FintechCheck <alerts@fintechcheck.uk>",
        to:   ADMIN_EMAIL,
        subject: `⚠ Weekly report aborted — ${abortDate}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ef4444">Weekly report not sent</h2>
          <p>The weekly stablecoin report was <strong>not dispatched</strong> to subscribers.</p>
          <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><td style="padding:6px 10px;font-weight:700;background:#f9fafb">Reason</td>
                <td style="padding:6px 10px">${abortReason}</td></tr>
            <tr><td style="padding:6px 10px;font-weight:700;background:#f9fafb">Coins with data</td>
                <td style="padding:6px 10px">${coinsWithData} / ${slugs.length}</td></tr>
            <tr><td style="padding:6px 10px;font-weight:700;background:#f9fafb">Time window</td>
                <td style="padding:6px 10px">since ${sinceIso}</td></tr>
            <tr><td style="padding:6px 10px;font-weight:700;background:#f9fafb">Report date</td>
                <td style="padding:6px 10px">${abortDate}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:12px;margin-top:16px">
            Fix the underlying issue and retrigger via POST /api/reports/weekly.
          </p>
        </div>`,
      }).catch(e => console.error("Abort alert email failed:", e));

      await supabase.from("report_sends").insert({
        email: ADMIN_EMAIL,
        report_date: abortDate,
        type: "aborted",
      });

      return NextResponse.json({ aborted: true, reason: abortReason, coinsWithData });
    }

    // ── Process whale data ─────────────────────────────────────────────────────
    const whale: WhaleStats = {
      count:       whaleCount ?? 0,
      totalVolume: Number((volData as { sum: string | number } | null)?.sum ?? 0),
      top3:        (whaleRows ?? []).slice(0, 3),
    };

    const topCoinsByVolume: CoinWhaleStats[] = ((coinVolRows ?? []) as {
      slug: string; transfer_count: number; total_volume: number;
    }[])
      .map(r => ({
        slug:        r.slug,
        name:        COIN_NAMES[r.slug] ?? r.slug.toUpperCase(),
        count:       Number(r.transfer_count),
        totalVolume: Number(r.total_volume),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    // ── Market score ───────────────────────────────────────────────────────────
    const pegScore = Math.round(
      coins.reduce((sum, c) => {
        const bps = (Math.abs(c.currentPrice - c.peg) / c.peg) * 10000;
        return sum + (bps < 20 ? 100 : bps < 50 ? 75 : bps < 200 ? 25 : 0);
      }, 0) / coins.length
    );

    let fearGreedScore: number | null = null;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
      const fgRes = await fetch(`${baseUrl}/api/fear-greed`);
      if (fgRes.ok) {
        const fgData = await fgRes.json();
        if (typeof fgData.score === "number") fearGreedScore = fgData.score;
      }
    } catch {}

    const marketScore = fearGreedScore !== null
      ? Math.round(0.5 * pegScore + 0.5 * fearGreedScore)
      : pegScore;

    const baseUrlForLinks = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pegcheck.uk";

    // Subject: exclude chronic depeg coins and "Above peg" coins from the depeg alarm
    const subjectDepegList = coins
      .filter(c => c.status === "Depeg" && !CHRONIC_DEPEG.has(c.slug))
      .map(c => c.name);
    const subjectAbovePegList = coins
      .filter(c => c.status === "Above peg" && !CHRONIC_DEPEG.has(c.slug))
      .map(c => c.name);
    const subjectSuffix =
      subjectDepegList.length > 0
        ? ` — ⚠ ${subjectDepegList.join(", ")} in depeg`
        : subjectAbovePegList.length > 0
        ? ` — ↑ ${subjectAbovePegList.join(", ")} above peg`
        : " — All systems healthy";
    const reportDate = new Date().toISOString().split("T")[0];

    // ── Dispatch emails ────────────────────────────────────────────────────────
    if (isAutomated) {
      const { data: subscribers, error: subError } = await supabase
        .from("subscribers")
        .select("email, unsubscribe_token")
        .eq("weekly_report", true);

      if (subError) {
        console.error("Weekly report — subscriber query error:", subError.message);
        return NextResponse.json({ error: subError.message }, { status: 500 });
      }
      if (!subscribers || subscribers.length === 0) {
        return NextResponse.json({ message: "No subscribers opted in to weekly reports", sent: 0 });
      }

      let sent = 0, failed = 0;
      for (const sub of subscribers) {
        const subUnsubUrl = sub.unsubscribe_token
          ? `${baseUrlForLinks}/api/unsubscribe?token=${sub.unsubscribe_token}`
          : `${baseUrlForLinks}/api/unsubscribe`;
        const html = buildHtml(coins, whale, topCoinsByVolume, weekOf, marketScore, pegScore, fearGreedScore, maxSources, subUnsubUrl);
        try {
          const { error: sendError } = await resend.emails.send(
            {
              from:    "FintechCheck <alerts@fintechcheck.uk>",
              to:      sub.email,
              subject: `FintechCheck Weekly Report · ${weekOf}${subjectSuffix}`,
              html,
              headers: {
                "List-Unsubscribe":      `<${subUnsubUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            },
            { idempotencyKey: `weekly-${reportDate}-${sub.unsubscribe_token ?? sub.email}` },
          );
          if (sendError) {
            console.error(`Weekly report send failed for ${sub.email}:`, sendError);
            failed++;
          } else {
            await supabase.from("report_sends").insert({
              email: sub.email, report_date: reportDate, type: sendType,
            });
            sent++;
          }
        } catch (e) {
          console.error(`Weekly report send exception for ${sub.email}:`, e);
          failed++;
        }
        await new Promise(r => setTimeout(r, 600));
      }

      console.log(`Weekly report: sent=${sent} failed=${failed} total=${subscribers.length} coinsWithData=${coinsWithData}`);

      return NextResponse.json({
        success: true, sent, failed, total: subscribers.length,
        marketScore, pegScore, fearGreedScore, coinsWithData,
        whaleTransfers: whale.count, whaleTotalVolume: whale.totalVolume,
      });

    } else {
      const subUnsubUrl = unsubscribeToken
        ? `${baseUrlForLinks}/api/unsubscribe?token=${unsubscribeToken}`
        : `${baseUrlForLinks}/api/unsubscribe`;
      const html = buildHtml(coins, whale, topCoinsByVolume, weekOf, marketScore, pegScore, fearGreedScore, maxSources, subUnsubUrl);

      await resend.emails.send({
        from:    "FintechCheck <alerts@fintechcheck.uk>",
        to,
        subject: `FintechCheck Weekly Report · ${weekOf}${subjectSuffix}`,
        html,
        headers: {
          "List-Unsubscribe":      `<${subUnsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      const { error: logError } = await supabase.from("report_sends").insert({
        email: to, report_date: reportDate, type: sendType,
      });
      if (logError) console.error("report_sends log error:", logError.message);

      return NextResponse.json({
        success: true, sentTo: to, marketScore, pegScore, fearGreedScore, coinsWithData,
        whaleTransfers: whale.count, whaleTotalVolume: whale.totalVolume,
      });
    }

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
