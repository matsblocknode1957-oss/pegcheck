/**
 * Replay CLI — runs live agent rules over saved price_history offline.
 *
 * npx tsx replay/download.ts                          # download first
 * npx tsx replay/replay.ts                            # base replay (live config)
 * npx tsx replay/replay.ts --overrides '{"STALE_EXIT_HOURS":48}'
 * npx tsx replay/replay.ts --overrides replay/configs/stale48.json
 * npx tsx replay/replay.ts --compare  replay/configs/stale48.json
 * npx tsx replay/replay.ts --debug                    # diagnose zero-trade issues
 */

import * as fs from "fs";
import {
  loadDatasets, runReplay,
  ReplayOverrides, ClosedTrade, ReplayResult, DebugDecision,
} from "./engine";

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

function parseArgs(): { overrides: ReplayOverrides; compare: ReplayOverrides | null; debug: boolean } {
  const argv = process.argv.slice(2);
  let overrides: ReplayOverrides = {};
  let compare: ReplayOverrides | null = null;
  let debug = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--overrides" && argv[i + 1]) overrides = parseOverridesArg(argv[++i]!);
    if (argv[i] === "--compare"   && argv[i + 1]) compare   = parseOverridesArg(argv[++i]!);
    if (argv[i] === "--debug") debug = true;
  }
  return { overrides, compare, debug };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const fmtTs    = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
const fmtPrice = (p: number) => p.toFixed(4);
const fmtPnl   = (n: number) => (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(2);
const fmtPct   = (wins: number, total: number) =>
  total > 0 ? ((wins / total) * 100).toFixed(1) + "%" : "—";

// ── Dataset statistics (always printed after load) ────────────────────────────

function avgGapMin(rows: Array<{ tsMs: number }>, utcYear: number, utcMonth: number): string {
  const ts = rows
    .filter(r => {
      const d = new Date(r.tsMs);
      return d.getUTCFullYear() === utcYear && d.getUTCMonth() === utcMonth;
    })
    .map(r => r.tsMs);
  if (ts.length < 2) return "—";
  let total = 0;
  for (let i = 1; i < ts.length; i++) total += ts[i]! - ts[i - 1]!;
  return (total / (ts.length - 1) / 60_000).toFixed(1) + "m";
}

function printDatasetStats(datasets: ReturnType<typeof loadDatasets>): void {
  const cols = [8, 7, 16, 16, 9, 9];
  const hdrs = ["coin", "rows", "first", "last", "gap_aug", "gap_oct"];
  console.log("  " + hdrs.map((h, i) => h.padEnd(cols[i]!)).join("  "));
  console.log("  " + cols.map(w => "-".repeat(w)).join("  "));
  for (const ds of datasets) {
    const first = ds.rows[0]?.tsMs;
    const last  = ds.rows[ds.rows.length - 1]?.tsMs;
    const vals = [
      ds.slug,
      String(ds.rows.length),
      first != null ? new Date(first).toISOString().slice(0, 16).replace("T", " ") : "—",
      last  != null ? new Date(last ).toISOString().slice(0, 16).replace("T", " ") : "—",
      avgGapMin(ds.rows, 2026, 7),  // August  (month 7, 0-indexed)
      avgGapMin(ds.rows, 2026, 9),  // October (month 9, 0-indexed)
    ];
    console.log("  " + vals.map((v, i) => v.padEnd(cols[i]!)).join("  "));
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

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const { overrides, compare, debug } = parseArgs();

  console.log("Loading datasets...");
  const datasets = loadDatasets(COINS);
  printDatasetStats(datasets);

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
