/**
 * Replay CLI — runs live agent rules over saved price_history offline.
 *
 * npx tsx replay/download.ts                          # download first
 * npx tsx replay/replay.ts                            # base replay (live config)
 * npx tsx replay/replay.ts --overrides '{"STALE_EXIT_HOURS":48}'
 * npx tsx replay/replay.ts --overrides replay/configs/stale48.json
 * npx tsx replay/replay.ts --compare  replay/configs/stale48.json
 * npx tsx replay/replay.ts --bot-b                    # Bot A vs Bot B + monthly + ex-MKUSD
 * npx tsx replay/replay.ts --debug                    # diagnose zero-trade issues
 */

import * as fs   from "fs";
import * as path from "path";
import {
  loadDatasets, runReplay,
  ReplayOverrides, ClosedTrade, ReplayResult, DebugDecision,
} from "./engine";
import { runReplayBotB, BotBConfig, ClosedBotBTrade, BotBReplayResult } from "./engineBotB";

const COINS = [
  "mkusd", "usdp", "bold", "alusd", "frax",
  "lusd", "usdc", "usdt", "dai", "gho", "crvusd",
];

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseOverridesArg(raw: string): ReplayOverrides {
  const s = raw.trim();
  if (s.startsWith("{")) return JSON.parse(s) as ReplayOverrides;
  return JSON.parse(fs.readFileSync(s, "utf8")) as ReplayOverrides;
}

function parseArgs(): {
  overrides: ReplayOverrides; compare: ReplayOverrides | null; debug: boolean; botB: boolean;
} {
  const argv = process.argv.slice(2);
  let overrides: ReplayOverrides = {};
  let compare: ReplayOverrides | null = null;
  let debug = false;
  let botB  = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--overrides" && argv[i + 1]) overrides = parseOverridesArg(argv[++i]!);
    if (argv[i] === "--compare"   && argv[i + 1]) compare   = parseOverridesArg(argv[++i]!);
    if (argv[i] === "--debug") debug = true;
    if (argv[i] === "--bot-b") botB  = true;
  }
  return { overrides, compare, debug, botB };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const fmtTs    = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
const fmtPrice = (p: number) => p.toFixed(4);
const fmtPnl   = (n: number) => (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(2);
const fmtPct   = (wins: number, total: number) =>
  total > 0 ? ((wins / total) * 100).toFixed(1) + "%" : "—";

// ── Data-quality helpers ──────────────────────────────────────────────────────

interface MonthStats {
  rowCount: number;
  avgGapMin: number | null;
  longGapCount: number;   // gaps > 2h
  longestGapMin: number;
}

function computeMonthStats(rows: Array<{ tsMs: number }>): Map<string, MonthStats> {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const d   = new Date(row.tsMs);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b   = buckets.get(key);
    if (b) b.push(row.tsMs);
    else buckets.set(key, [row.tsMs]);
  }

  const result = new Map<string, MonthStats>();
  for (const [key, ts] of buckets) {
    let totalMs = 0, longGapCount = 0, longestGapMin = 0;
    for (let i = 1; i < ts.length; i++) {
      const gapMs  = ts[i]! - ts[i - 1]!;
      totalMs     += gapMs;
      const gapMin = gapMs / 60_000;
      if (gapMin > 120) {
        longGapCount++;
        if (gapMin > longestGapMin) longestGapMin = gapMin;
      }
    }
    result.set(key, {
      rowCount:      ts.length,
      avgGapMin:     ts.length > 1 ? totalMs / (ts.length - 1) / 60_000 : null,
      longGapCount,
      longestGapMin,
    });
  }
  return result;
}

function printDataQuality(datasets: ReturnType<typeof loadDatasets>): void {
  const allStats  = new Map<string, Map<string, MonthStats>>();
  const monthSet  = new Set<string>();

  for (const ds of datasets) {
    const s = computeMonthStats(ds.rows);
    allStats.set(ds.slug, s);
    for (const k of s.keys()) monthSet.add(k);
  }
  const months = [...monthSet].sort();

  // ── Summary per coin ────────────────────────────────────────────────────────
  const sCols = [8, 7, 16, 16, 8];
  const sHdrs = ["coin", "rows", "first", "last", "avg_gap"];
  console.log("  " + sHdrs.map((h, i) => h.padEnd(sCols[i]!)).join("  "));
  console.log("  " + sCols.map(w => "-".repeat(w)).join("  "));
  for (const ds of datasets) {
    const first = ds.rows[0]?.tsMs;
    const last  = ds.rows[ds.rows.length - 1]?.tsMs;
    let totalMs = 0;
    for (let i = 1; i < ds.rows.length; i++) totalMs += ds.rows[i].tsMs - ds.rows[i - 1].tsMs;
    const avgMin = ds.rows.length > 1
      ? (totalMs / (ds.rows.length - 1) / 60_000).toFixed(1) + "m" : "—";
    const vals = [
      ds.slug,
      ds.rows.length.toLocaleString(),
      first != null ? new Date(first).toISOString().slice(0, 16).replace("T", " ") : "—",
      last  != null ? new Date(last ).toISOString().slice(0, 16).replace("T", " ") : "—",
      avgMin,
    ];
    console.log("  " + vals.map((v, i) => v.padEnd(sCols[i]!)).join("  "));
  }
  console.log();

  // ── Monthly avg gap matrix ──────────────────────────────────────────────────
  const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mLabels = months.map(mk => MONTH_NAMES[Number(mk.slice(5)) - 1] ?? mk.slice(5));
  const mw = 6, coinW = 8;
  console.log("  avg gap per month (minutes):");
  console.log("  " + "".padEnd(coinW) + "  " + mLabels.map(l => l.padEnd(mw)).join("  "));
  console.log("  " + "-".repeat(coinW) + "  " + months.map(() => "-".repeat(mw)).join("  "));
  for (const ds of datasets) {
    const s    = allStats.get(ds.slug)!;
    const vals = months.map(mk => {
      const ms = s.get(mk);
      return ms && ms.avgGapMin != null ? ms.avgGapMin.toFixed(1) + "m" : "—";
    });
    console.log("  " + ds.slug.padEnd(coinW) + "  " + vals.map(v => v.padEnd(mw)).join("  "));
  }
  console.log();

  // ── Gaps > 2h ──────────────────────────────────────────────────────────────
  const longGaps: Array<{ coin: string; month: string; count: number; longestMin: number }> = [];
  for (const ds of datasets) {
    for (const mk of months) {
      const ms = allStats.get(ds.slug)?.get(mk);
      if (ms && ms.longGapCount > 0) {
        longGaps.push({ coin: ds.slug, month: mk, count: ms.longGapCount, longestMin: ms.longestGapMin });
      }
    }
  }
  console.log("  gaps > 2h:");
  if (longGaps.length === 0) {
    console.log("  (none — data is clean)");
  } else {
    const gCols = [8, 8, 7, 10];
    const gHdrs = ["coin", "month", "count", "longest"];
    console.log("  " + gHdrs.map((h, i) => h.padEnd(gCols[i]!)).join("  "));
    console.log("  " + gCols.map(w => "-".repeat(w)).join("  "));
    for (const g of longGaps) {
      const longest = g.longestMin >= 60
        ? (g.longestMin / 60).toFixed(1) + "h" : g.longestMin.toFixed(0) + "m";
      const vals = [g.coin, g.month, String(g.count), longest];
      console.log("  " + vals.map((v, i) => v.padEnd(gCols[i]!)).join("  "));
    }
  }
  console.log();
}

// ── Trade table ───────────────────────────────────────────────────────────────

function printTrades(trades: ClosedTrade[]): void {
  if (trades.length === 0) { console.log("  (none)"); return; }
  const cols = [8, 16, 16, 7, 7, 6, 7, 9, 12];
  const hdrs = ["coin", "opened", "closed", "entry", "exit", "h", "size", "pnl", "reason"];
  console.log(hdrs.map((h, i) => h.padEnd(cols[i]!)).join("  "));
  console.log(cols.map(w => "-".repeat(w)).join("  "));
  for (const t of trades) {
    const vals = [
      t.coin, fmtTs(t.entryTs), fmtTs(t.exitTs),
      fmtPrice(t.entryPrice), fmtPrice(t.exitPrice),
      t.hoursHeld.toFixed(1), "$" + t.sizeUsd.toFixed(0),
      fmtPnl(t.pnlUsd), t.exitReason,
    ];
    console.log(vals.map((v, i) => v.padEnd(cols[i]!)).join("  "));
  }
}

// ── Per-coin summary ──────────────────────────────────────────────────────────

function printPerCoin(trades: ClosedTrade[]): void {
  const byCoin: Record<string, ClosedTrade[]> = {};
  for (const t of trades) {
    if (!byCoin[t.coin]) byCoin[t.coin] = [];
    byCoin[t.coin]!.push(t);
  }
  const cols = [8, 7, 5, 7, 11, 7];
  const hdrs = ["coin", "trades", "wins", "win%", "total_pnl", "avg_h"];
  console.log(hdrs.map((h, i) => h.padEnd(cols[i]!)).join("  "));
  console.log(cols.map(w => "-".repeat(w)).join("  "));
  for (const [coin, ts] of Object.entries(byCoin).sort(([a], [b]) => a.localeCompare(b))) {
    const wins = ts.filter(t => t.exitReason === "won").length;
    const pnl  = ts.reduce((s, t) => s + t.pnlUsd, 0);
    const avgH = ts.reduce((s, t) => s + t.hoursHeld, 0) / ts.length;
    const vals = [
      coin, String(ts.length), String(wins),
      fmtPct(wins, ts.length), fmtPnl(pnl), avgH.toFixed(1) + "h",
    ];
    console.log(vals.map((v, i) => v.padEnd(cols[i]!)).join("  "));
  }
}

// ── Summary helpers ───────────────────────────────────────────────────────────

interface Summary {
  trades: number; wins: number; pnl: number; avgH: number;
  slotFull: number; postWarmup: number; open: number;
}

function summarise(r: ReplayResult): Summary {
  const wins = r.closed.filter(t => t.exitReason === "won").length;
  const pnl  = r.closed.reduce((s, t) => s + t.pnlUsd, 0);
  const avgH = r.closed.length > 0
    ? r.closed.reduce((s, t) => s + t.hoursHeld, 0) / r.closed.length
    : 0;
  return {
    trades: r.closed.length, wins, pnl, avgH,
    slotFull: r.slotFullTicks, postWarmup: r.postWarmupTicks,
    open: r.stillOpen.length,
  };
}

function printOverall(s: Summary, label: string): void {
  const slotStr = s.postWarmup > 0
    ? ((s.slotFull / s.postWarmup) * 100).toFixed(1) + `% (${s.slotFull}/${s.postWarmup} ticks)`
    : "—";
  console.log(`\n=== ${label} ===`);
  console.log(`  Closed trades : ${s.trades}  (${s.open} still open at end of window)`);
  console.log(`  Wins          : ${s.wins}/${s.trades} (${fmtPct(s.wins, s.trades)})`);
  console.log(`  Total P&L     : ${fmtPnl(s.pnl)}`);
  console.log(`  Avg hold      : ${s.avgH.toFixed(1)}h`);
  console.log(`  Slot-full     : ${slotStr}`);
}

// ── Comparison mode ───────────────────────────────────────────────────────────

function printComparison(
  base: Summary, baseLabel: string,
  cmp:  Summary, cmpLabel:  string,
): void {
  const lw = 20;
  const vw = 18;
  const row = (label: string, bv: string, cv: string) =>
    `${label.padEnd(lw)}  ${bv.padEnd(vw)}  ${cv}`;
  const slotPct = (s: Summary) =>
    s.postWarmup > 0 ? ((s.slotFull / s.postWarmup) * 100).toFixed(1) + "%" : "—";

  console.log(`\n=== COMPARISON ===`);
  console.log(row("", baseLabel.slice(0, vw).padEnd(vw), cmpLabel.slice(0, vw)));
  console.log("-".repeat(lw + 2 + vw + 2 + vw));
  console.log(row("Closed trades",  String(base.trades),           String(cmp.trades)));
  console.log(row("Still open",     String(base.open),             String(cmp.open)));
  console.log(row("Win rate",        fmtPct(base.wins, base.trades), fmtPct(cmp.wins, cmp.trades)));
  console.log(row("Total P&L",       fmtPnl(base.pnl),             fmtPnl(cmp.pnl)));
  console.log(row("Avg hold",        base.avgH.toFixed(1) + "h",   cmp.avgH.toFixed(1) + "h"));
  console.log(row("Slot-full%",      slotPct(base),                 slotPct(cmp)));
}

// ── Sanity check window ───────────────────────────────────────────────────────

const SANITY_START = new Date("2026-10-06T00:00:00Z");
const SANITY_END   = new Date("2026-10-16T23:59:59Z");

function printSanity(trades: ClosedTrade[]): void {
  const inWindow = trades.filter(t => t.entryTs >= SANITY_START && t.entryTs <= SANITY_END);
  const byCoin: Record<string, number> = {};
  for (const t of inWindow) byCoin[t.coin] = (byCoin[t.coin] ?? 0) + 1;
  const coinStr = Object.entries(byCoin).map(([c, n]) => `${c}×${n}`).join(", ") || "none";
  const wins = inWindow.filter(t => t.exitReason === "won").length;
  const pnl  = inWindow.reduce((s, t) => s + t.pnlUsd, 0);

  console.log("\n=== SANITY (Oct 6–16 window) ===");
  console.log(`  Trades  : ${inWindow.length} (${coinStr})`);
  console.log(`  Wins    : ${wins}/${inWindow.length}`);
  console.log(`  P&L     : ${fmtPnl(pnl)}`);
  console.log(`  Cross-ref SQL:`);
  console.log(`    SELECT coin, entry_price, price, pnl_usd, status`);
  console.log(`    FROM agent_trades`);
  console.log(`    WHERE mode = 'live' AND decided_at >= '2026-10-06' AND decided_at <= '2026-10-16';`);
}

// ── Debug report ──────────────────────────────────────────────────────────────

function printDebugReport(decisions: DebugDecision[]): void {
  const inWindow = decisions.filter(
    d => d.tsMs >= SANITY_START.getTime() && d.tsMs <= SANITY_END.getTime(),
  );

  console.log("\n=== DEBUG REPORT (Oct 6–16 window) ===");
  console.log(`  Total decide() calls in window : ${inWindow.length}`);

  if (inWindow.length === 0) {
    console.log("  (no dip-zone activity — no coin was >= 0.5% below peg in this window)");
    return;
  }

  // Per-coin decision counts
  type CoinStat = { calls: number; buy: number; watch: number; avoid: number };
  const coinStats: Record<string, CoinStat> = {};
  for (const d of inWindow) {
    if (!coinStats[d.coin]) coinStats[d.coin] = { calls: 0, buy: 0, watch: 0, avoid: 0 };
    const s = coinStats[d.coin]!;
    s.calls++;
    if (d.decision === "buy")   s.buy++;
    if (d.decision === "watch") s.watch++;
    if (d.decision === "avoid") s.avoid++;
  }

  console.log("\n  decide() calls per coin (Oct 6–16):");
  const cc = [8, 7, 6, 7, 7];
  const ch = ["coin", "calls", "buy", "watch", "avoid"];
  console.log("  " + ch.map((h, i) => h.padEnd(cc[i]!)).join("  "));
  console.log("  " + cc.map(w => "-".repeat(w)).join("  "));
  for (const [coin, s] of Object.entries(coinStats).sort(([a], [b]) => a.localeCompare(b))) {
    const vals = [coin, String(s.calls), String(s.buy), String(s.watch), String(s.avoid)];
    console.log("  " + vals.map((v, i) => v.padEnd(cc[i]!)).join("  "));
  }

  // Top 10 danger reasons from non-buy decisions
  const reasonCounts: Record<string, number> = {};
  for (const d of inWindow) {
    if (d.decision !== "buy") {
      for (const reason of d.dangerReasons) {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      }
    }
  }

  const topReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (topReasons.length > 0) {
    console.log("\n  Top danger reasons (non-buy decisions, Oct 6–16):");
    for (const [reason, count] of topReasons) {
      console.log(`    ${String(count).padStart(5)}  ${reason}`);
    }
  }
}

// ── Bot B comparison helpers ──────────────────────────────────────────────────

interface BotBSummary {
  trades: number; wins: number; losses: number; stale: number; timedOut: number;
  pnl: number; avgH: number; maxCapital: number;
  slotFull: number; postWarmup: number; open: number; doubled: number;
}

function summariseBotB(r: BotBReplayResult): BotBSummary {
  const wins    = r.closed.filter(t => t.exitReason === "won").length;
  const losses  = r.closed.filter(t => t.exitReason === "lost").length;
  const stale   = r.closed.filter(t => t.exitReason === "stale_exit").length;
  const timedOut = r.closed.filter(t => t.exitReason === "timed_out").length;
  const doubled = r.closed.filter(t => t.doubled).length;
  const pnl     = r.closed.reduce((s, t) => s + t.pnlUsd, 0);
  const avgH    = r.closed.length > 0
    ? r.closed.reduce((s, t) => s + t.hoursHeld, 0) / r.closed.length : 0;
  return {
    trades: r.closed.length, wins, losses, stale, timedOut,
    pnl, avgH, maxCapital: r.maxCapitalUsd,
    slotFull: r.slotFullTicks, postWarmup: r.postWarmupTicks,
    open: r.stillOpen.length, doubled,
  };
}

interface BotASummaryFull {
  trades: number; wins: number; losses: number; stale: number; timedOut: number;
  pnl: number; avgH: number; maxCapital: number;
  slotFull: number; postWarmup: number; open: number;
}

function summariseBotA(r: ReplayResult): BotASummaryFull {
  const wins    = r.closed.filter(t => t.exitReason === "won").length;
  const losses  = r.closed.filter(t => t.exitReason === "lost").length;
  const stale   = r.closed.filter(t => t.exitReason === "stale_exit").length;
  const timedOut = r.closed.filter(t => t.exitReason === "timed_out").length;
  const pnl     = r.closed.reduce((s, t) => s + t.pnlUsd, 0);
  const avgH    = r.closed.length > 0
    ? r.closed.reduce((s, t) => s + t.hoursHeld, 0) / r.closed.length : 0;
  return {
    trades: r.closed.length, wins, losses, stale, timedOut,
    pnl, avgH, maxCapital: r.maxCapitalUsd,
    slotFull: r.slotFullTicks, postWarmup: r.postWarmupTicks,
    open: r.stillOpen.length,
  };
}

function worstTrade(trades: ClosedTrade[]): string {
  if (trades.length === 0) return "—";
  const w = trades.reduce((a, b) => a.pnlUsd < b.pnlUsd ? a : b);
  return `${w.coin} opened ${fmtTs(w.entryTs)} @ ${fmtPrice(w.entryPrice)} → ${fmtPrice(w.exitPrice)} (${fmtPnl(w.pnlUsd)}, ${w.exitReason})`;
}

function printBotAPanel(s: BotASummaryFull, closed: ClosedTrade[], label: string): void {
  const avgPnl = s.trades > 0 ? s.pnl / s.trades : 0;
  const slotStr = s.postWarmup > 0
    ? ((s.slotFull / s.postWarmup) * 100).toFixed(1) + "%" : "—";
  console.log(`\n=== ${label} ===`);
  console.log(`  Closed trades  : ${s.trades}  (${s.open} still open)`);
  console.log(`  Wins           : ${s.wins}/${s.trades} (${fmtPct(s.wins, s.trades)})`);
  console.log(`  Losses         : ${s.losses}`);
  console.log(`  Stale exits    : ${s.stale}`);
  console.log(`  Timed out      : ${s.timedOut}`);
  console.log(`  Total P&L      : ${fmtPnl(s.pnl)}`);
  console.log(`  Avg P&L/trade  : ${fmtPnl(avgPnl)}`);
  console.log(`  Avg hold       : ${s.avgH.toFixed(1)}h`);
  console.log(`  Max capital    : $${s.maxCapital.toFixed(0)}`);
  console.log(`  Slot-full      : ${slotStr}`);
  console.log(`  Worst trade    : ${worstTrade(closed)}`);
}

function printBotBPanel(s: BotBSummary, closed: ClosedBotBTrade[], label: string): void {
  const avgPnl = s.trades > 0 ? s.pnl / s.trades : 0;
  const slotStr = s.postWarmup > 0
    ? ((s.slotFull / s.postWarmup) * 100).toFixed(1) + "%" : "—";
  console.log(`\n=== ${label} ===`);
  console.log(`  Closed trades  : ${s.trades}  (${s.open} still open)  [${s.doubled} doubled]`);
  console.log(`  Wins           : ${s.wins}/${s.trades} (${fmtPct(s.wins, s.trades)})`);
  console.log(`  Losses         : ${s.losses}`);
  console.log(`  Stale exits    : ${s.stale}`);
  console.log(`  Timed out      : ${s.timedOut}`);
  console.log(`  Total P&L      : ${fmtPnl(s.pnl)}`);
  console.log(`  Avg P&L/trade  : ${fmtPnl(avgPnl)}`);
  console.log(`  Avg hold       : ${s.avgH.toFixed(1)}h`);
  console.log(`  Max capital    : $${s.maxCapital.toFixed(0)}`);
  console.log(`  Slot-full      : ${slotStr}`);
  console.log(`  Worst trade    : ${worstTrade(closed)}`);
}

function printBotBSideBySide(
  sA: BotASummaryFull, sB: BotBSummary,
): void {
  const lw = 18, vw = 20;
  const row = (label: string, a: string, b: string) =>
    `  ${label.padEnd(lw)}  ${a.padEnd(vw)}  ${b}`;
  console.log("\n=== SIDE BY SIDE ===");
  console.log(row("Metric", "Bot A (v3.1 + fee)", "Bot B (Bold + fee)"));
  console.log("  " + "-".repeat(lw + 2 + vw + 2 + vw));
  console.log(row("Closed trades",  String(sA.trades),                  String(sB.trades)));
  console.log(row("Still open",     String(sA.open),                    String(sB.open)));
  console.log(row("Wins",           `${sA.wins} (${fmtPct(sA.wins, sA.trades)})`, `${sB.wins} (${fmtPct(sB.wins, sB.trades)})`));
  console.log(row("Losses",         String(sA.losses),                  String(sB.losses)));
  console.log(row("Stale exits",    String(sA.stale),                   String(sB.stale)));
  console.log(row("Timed out",      String(sA.timedOut),                String(sB.timedOut)));
  console.log(row("Total P&L",      fmtPnl(sA.pnl),                    fmtPnl(sB.pnl)));
  console.log(row("Avg P&L/trade",  fmtPnl(sA.trades > 0 ? sA.pnl / sA.trades : 0),
                                    fmtPnl(sB.trades > 0 ? sB.pnl / sB.trades : 0)));
  console.log(row("Avg hold",       sA.avgH.toFixed(1) + "h",          sB.avgH.toFixed(1) + "h"));
  console.log(row("Max capital",    "$" + sA.maxCapital.toFixed(0),     "$" + sB.maxCapital.toFixed(0)));
}

function printBotBPerCoin(
  aClosedIn: ClosedTrade[],
  bClosedIn: ClosedBotBTrade[],
): void {
  const allCoins = new Set([
    ...aClosedIn.map(t => t.coin),
    ...bClosedIn.map(t => t.coin),
  ]);
  const cols = [8, 22, 22];
  const hdrs = ["coin", "Bot A (trades/pnl/win%)", "Bot B (trades/pnl/win%/doubled)"];
  console.log("\n=== PER-COIN BREAKDOWN ===");
  console.log("  " + hdrs.map((h, i) => h.padEnd(cols[i]!)).join("  "));
  console.log("  " + cols.map(w => "-".repeat(w)).join("  "));
  for (const coin of [...allCoins].sort()) {
    const aTs  = aClosedIn.filter(t => t.coin === coin);
    const bTs  = bClosedIn.filter(t => t.coin === coin);
    const aWins = aTs.filter(t => t.exitReason === "won").length;
    const bWins = bTs.filter(t => t.exitReason === "won").length;
    const aPnl  = aTs.reduce((s, t) => s + t.pnlUsd, 0);
    const bPnl  = bTs.reduce((s, t) => s + t.pnlUsd, 0);
    const bDbl  = bTs.filter(t => t.doubled).length;
    const aStr  = aTs.length > 0
      ? `${aTs.length} trades  ${fmtPnl(aPnl)}  ${fmtPct(aWins, aTs.length)}`
      : "—";
    const bStr  = bTs.length > 0
      ? `${bTs.length} trades  ${fmtPnl(bPnl)}  ${fmtPct(bWins, bTs.length)}  ${bDbl}×dbl`
      : "—";
    console.log("  " + [coin, aStr, bStr].map((v, i) => v.padEnd(cols[i]!)).join("  "));
  }
}

function explainDivergence(a: ClosedTrade, b: ClosedBotBTrade): string {
  const parts: string[] = [];
  if (b.doubled) parts.push(`B doubled (2nd $500 at ${fmtPrice(b.entryPrice)})`);
  if (a.exitReason !== b.exitReason) parts.push(`A exited via ${a.exitReason}, B via ${b.exitReason}`);
  if (Math.abs(a.hoursHeld - b.hoursHeld) > 2) {
    const longer = a.hoursHeld > b.hoursHeld ? "A" : "B";
    parts.push(`${longer} held ${Math.abs(a.hoursHeld - b.hoursHeld).toFixed(0)}h longer`);
  }
  if (Math.abs(a.exitPrice - b.exitPrice) > 0.0001) {
    parts.push(`different exit prices (A ${fmtPrice(a.exitPrice)}, B ${fmtPrice(b.exitPrice)})`);
  }
  return parts.length > 0 ? parts.join("; ") : "similar outcomes, small fee difference";
}

function printTopDivergences(aClosed: ClosedTrade[], bClosed: ClosedBotBTrade[]): void {
  type Pair = { a: ClosedTrade; b: ClosedBotBTrade; diff: number };
  const pairs: Pair[] = [];

  for (const a of aClosed) {
    // Find closest Bot B trade for same coin within 6h
    const candidates = bClosed.filter(
      b => b.coin === a.coin && Math.abs(b.entryTs.getTime() - a.entryTs.getTime()) < 6 * 3_600_000,
    );
    if (candidates.length === 0) continue;
    const b = candidates.reduce((best, c) =>
      Math.abs(c.entryTs.getTime() - a.entryTs.getTime()) <
      Math.abs(best.entryTs.getTime() - a.entryTs.getTime()) ? c : best,
    );
    pairs.push({ a, b, diff: Math.abs(a.pnlUsd - b.pnlUsd) });
  }

  pairs.sort((x, y) => y.diff - x.diff);
  const top = pairs.slice(0, 5);

  console.log("\n=== TOP 5 DIVERGENCES (A vs B) ===");
  if (top.length === 0) {
    console.log("  (no matched pairs — all trades had large entry-time gaps)");
    return;
  }
  for (let i = 0; i < top.length; i++) {
    const { a, b, diff } = top[i]!;
    console.log(`\n  ${i + 1}. ${a.coin.toUpperCase()}  opened ${fmtTs(a.entryTs)}`);
    console.log(`     Bot A: ${fmtPnl(a.pnlUsd).padEnd(10)} ${a.exitReason}  ${a.hoursHeld.toFixed(1)}h  @${fmtPrice(a.entryPrice)}→${fmtPrice(a.exitPrice)}`);
    console.log(`     Bot B: ${fmtPnl(b.pnlUsd).padEnd(10)} ${b.exitReason}  ${b.hoursHeld.toFixed(1)}h  @${fmtPrice(b.entryPrice)}→${fmtPrice(b.exitPrice)}${b.doubled ? "  [doubled]" : ""}`);
    console.log(`     Δ P&L: ${fmtPnl(b.pnlUsd - a.pnlUsd)} — ${explainDivergence(a, b)}`);
  }
}

function printMonthlyBreakdown(aClosed: ClosedTrade[], bClosed: ClosedBotBTrade[]): void {
  const monthSet = new Set<string>();
  for (const t of [...aClosed, ...bClosed]) monthSet.add(t.entryTs.toISOString().slice(0, 7));
  if (monthSet.size === 0) return;
  const months = [...monthSet].sort();

  const lw = 8, aw = 28;
  console.log("\n=== MONTHLY BREAKDOWN ===");
  console.log(
    `  ${"month".padEnd(lw)}  ${"Bot A (n / P&L / win%)".padEnd(aw)}  Bot B (n / P&L / win% / dbl)`,
  );
  console.log("  " + "-".repeat(lw + 2 + aw + 2 + 30));
  for (const mk of months) {
    const aM   = aClosed.filter(t => t.entryTs.toISOString().slice(0, 7) === mk);
    const bM   = bClosed.filter(t => t.entryTs.toISOString().slice(0, 7) === mk);
    const aWin = aM.filter(t => t.exitReason === "won").length;
    const bWin = bM.filter(t => t.exitReason === "won").length;
    const aPnl = aM.reduce((s, t) => s + t.pnlUsd, 0);
    const bPnl = bM.reduce((s, t) => s + t.pnlUsd, 0);
    const bDbl = bM.filter(t => t.doubled).length;
    const n    = (n: number) => n === 1 ? "1 trade " : `${n} trades`;
    const aStr = aM.length > 0 ? `${n(aM.length)} ${fmtPnl(aPnl)}  ${fmtPct(aWin, aM.length)}` : "—";
    const bStr = bM.length > 0 ? `${n(bM.length)} ${fmtPnl(bPnl)}  ${fmtPct(bWin, bM.length)}  ${bDbl}×dbl` : "—";
    console.log(`  ${mk.padEnd(lw)}  ${aStr.padEnd(aw)}  ${bStr}`);
  }
}

function runBotBComparison(datasets: ReturnType<typeof loadDatasets>): void {
  const cfgPath = path.resolve(process.cwd(), "replay/configs/botB.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as BotBConfig;

  console.log(`\nRunning Bot A (live v3.1 rules, ${(cfg.SWAP_FEE_PCT * 100).toFixed(2)}% fee)...`);
  const aResult = runReplay(datasets, {}, { swapFeePct: cfg.SWAP_FEE_PCT });

  console.log(`Running Bot B (Bold: split buys + trailing, ${(cfg.SWAP_FEE_PCT * 100).toFixed(2)}% fee)...`);
  const bResult = runReplayBotB(datasets, cfg);

  const sA = summariseBotA(aResult);
  const sB = summariseBotB(bResult);

  const feePct = (cfg.SWAP_FEE_PCT * 100).toFixed(2);

  console.log("\n" + "─".repeat(60));
  console.log("ALL COINS");
  console.log("─".repeat(60));
  printBotAPanel(sA, aResult.closed, `BOT A — v3.1 + ${feePct}% fee`);
  printBotBPanel(sB, bResult.closed, `BOT B — Bold + ${feePct}% fee`);
  printBotBSideBySide(sA, sB);
  printBotBPerCoin(aResult.closed, bResult.closed);
  printTopDivergences(aResult.closed, bResult.closed);
  printMonthlyBreakdown(aResult.closed, bResult.closed);

  // ── Without MKUSD ──────────────────────────────────────────────────────────
  const datasetsNoMkusd = datasets.filter(d => d.slug !== "mkusd");
  console.log("\n" + "─".repeat(60));
  console.log("WITHOUT MKUSD");
  console.log("─".repeat(60));
  console.log(`\nRunning Bot A (ex-MKUSD, ${feePct}% fee)...`);
  const aX = runReplay(datasetsNoMkusd, {}, { swapFeePct: cfg.SWAP_FEE_PCT });
  console.log(`Running Bot B (ex-MKUSD, ${feePct}% fee)...`);
  const bX = runReplayBotB(datasetsNoMkusd, cfg);
  const sAx = summariseBotA(aX);
  const sBx = summariseBotB(bX);
  printBotAPanel(sAx, aX.closed, `BOT A — ex-MKUSD + ${feePct}% fee`);
  printBotBPanel(sBx, bX.closed, `BOT B — ex-MKUSD + ${feePct}% fee`);
  printBotBSideBySide(sAx, sBx);
  printBotBPerCoin(aX.closed, bX.closed);
  printTopDivergences(aX.closed, bX.closed);
  printMonthlyBreakdown(aX.closed, bX.closed);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const { overrides, compare, debug, botB } = parseArgs();

  console.log("Loading datasets...");
  const datasets = loadDatasets(COINS);
  printDataQuality(datasets);

  if (botB) {
    runBotBComparison(datasets);
    return;
  }

  if (compare !== null) {
    if (Object.keys(overrides).length > 0) {
      console.warn("[replay] --overrides ignored in --compare mode (base is always live config)\n");
    }
    console.log("Running base (live config)...");
    const baseResult = runReplay(datasets, {}, { debug });
    console.log("Running compare...");
    const cmpResult  = runReplay(datasets, compare);

    printComparison(
      summarise(baseResult), "base (live config)",
      summarise(cmpResult),  JSON.stringify(compare),
    );
    printSanity(baseResult.closed);
    if (debug && baseResult.debugDecisions.length > 0) printDebugReport(baseResult.debugDecisions);

  } else {
    const label = Object.keys(overrides).length > 0
      ? "overrides: " + JSON.stringify(overrides)
      : "live config";
    console.log(`Running replay (${label})...`);
    const result = runReplay(datasets, overrides, { debug });

    if (result.closed.length > 0) {
      console.log("\n=== CLOSED TRADES ===");
      printTrades(result.closed);
      console.log("\n=== PER-COIN SUMMARY ===");
      printPerCoin(result.closed);
    } else {
      console.log("\nNo closed trades.");
    }

    printOverall(summarise(result), "OVERALL");

    if (result.stillOpen.length > 0) {
      console.log("\n=== STILL OPEN AT END OF WINDOW ===");
      for (const t of result.stillOpen) {
        console.log(`  ${t.coin.padEnd(8)} opened ${fmtTs(t.openedAt)} @ ${fmtPrice(t.entry)}`);
      }
    }

    printSanity(result.closed);
    if (debug && result.debugDecisions.length > 0) printDebugReport(result.debugDecisions);
  }
}

main();
