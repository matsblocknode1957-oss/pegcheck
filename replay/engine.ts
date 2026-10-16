/**
 * Replay engine — simulation core.
 *
 * Imports rules.ts and config.ts directly (no copies).
 * HistoryStats computation mirrors the live coin_history_stats RPC exactly.
 * Not simulated: source spread, whale transfers (set to neutral).
 */

import * as path from "path";
import * as fs   from "fs";

import { decide, checkExit, Evidence } from "@/lib/agent/rules";
import type { OpenTrade } from "@/lib/agent/rules";
import { computeMedian, computeHadPriorDipCycle } from "@/lib/agent/history";
import {
  DIP_ZONE_START_PCT,
  DEEP_DEPEG_PCT,
  LIVES_BELOW_PEG_THRESHOLD,
  RULES_VERSION,
  getCoinTier,
  STALE_EXIT_HOURS,
  STALE_EXIT_MIN_PROFIT_PCT,
  TAKE_PROFIT_DISTANCE_PCT,
} from "@/lib/agent/config";
import { COIN_PEGS } from "@/lib/coinPegs";

// 5-minute grid mirrors live cron cadence
const TICK_INTERVAL_MS = 5 * 60 * 1000;

// ── Public types ──────────────────────────────────────────────────────────────

export interface DebugDecision {
  tsMs: number;
  coin: string;
  decision: string;
  dangerReasons: string[];
  dangerScore: number;
}

export interface RunReplayOptions {
  debug?: boolean;
}

export interface ReplayOverrides {
  STALE_EXIT_HOURS?: number;
  TAKE_PROFIT_DISTANCE_PCT?: number;
  STALE_EXIT_MIN_PROFIT_PCT?: number;
}

export interface SimTrade {
  coin: string;
  peg: number;
  entry: number;
  sizeUsd: number;
  openedAt: Date;
  rulesVersion: string;
}

export interface ClosedTrade {
  coin: string;
  entryTs: Date;
  exitTs: Date;
  entryPrice: number;
  exitPrice: number;
  hoursHeld: number;
  sizeUsd: number;
  pnlUsd: number;
  exitReason: string;
}

export interface ReplayResult {
  closed: ClosedTrade[];
  stillOpen: SimTrade[];
  slotFullTicks: number;
  postWarmupTicks: number;
  debugDecisions: DebugDecision[]; // populated only when RunReplayOptions.debug is true
}

// ── Internal types ────────────────────────────────────────────────────────────

interface PhRow {
  id: number;
  created_at: string;
  price: number;
  deviation_bps: number | null; // null in pre-migration rows; download.ts fills most via fallback
  tsMs: number;
}

interface Seeds {
  firstSeen: string | null;
  lastAtPegBeforeWindow: string | null;
}

interface CoinDataset {
  slug: string;
  peg: number;
  rows: PhRow[];        // sorted ascending by tsMs
  firstSeenMs: number;  // global min created_at (from seed)
  seedLastAtPegMs: number | null; // last_at_peg BEFORE download window (from seed)
}

// ── Data loading ──────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "replay/data");

function loadJsonl(file: string): PhRow[] {
  const raw = fs.readFileSync(file, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const r = JSON.parse(line) as {
        id: number;
        created_at: string;
        price: unknown;
        deviation_bps: unknown;
      };
      // Explicit Number() coercions defend against strings written by old versions of the
      // download script or by Supabase returning numeric columns as strings.
      const devBps = (r.deviation_bps === null || r.deviation_bps === undefined)
        ? null : Number(r.deviation_bps);
      return {
        id:            Number(r.id),
        created_at:    r.created_at as string,
        price:         Number(r.price),
        deviation_bps: devBps,
        tsMs:          Date.parse(r.created_at as string),
      };
    });
}

export function loadDatasets(coins: string[]): CoinDataset[] {
  const seedsPath = path.join(DATA_DIR, "seeds.json");
  if (!fs.existsSync(seedsPath)) {
    throw new Error(`replay/data/seeds.json not found — run: npx tsx replay/download.ts`);
  }
  const allSeeds = JSON.parse(fs.readFileSync(seedsPath, "utf8")) as Record<string, Seeds>;

  const datasets: CoinDataset[] = [];

  for (const slug of coins) {
    const filePath = path.join(DATA_DIR, `${slug}.jsonl`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`replay/data/${slug}.jsonl not found — run: npx tsx replay/download.ts`);
    }
    const peg = COIN_PEGS[slug];
    if (peg === undefined) throw new Error(`No peg for coin: ${slug}`);

    const rows = loadJsonl(filePath);
    rows.sort((a, b) => a.tsMs - b.tsMs);

    const seeds = allSeeds[slug];
    if (!seeds) throw new Error(`No seed entry for coin: ${slug}`);

    const firstSeenMs = seeds.firstSeen ? Date.parse(seeds.firstSeen) : (rows[0]?.tsMs ?? 0);
    const seedLastAtPegMs = seeds.lastAtPegBeforeWindow ? Date.parse(seeds.lastAtPegBeforeWindow) : null;

    datasets.push({ slug, peg, rows, firstSeenMs, seedLastAtPegMs });
  }

  return datasets;
}

// ── Binary search helpers ─────────────────────────────────────────────────────

// Index of last row where rows[i].tsMs <= target; -1 if none.
function floorIdx(rows: PhRow[], target: number): number {
  let lo = 0, hi = rows.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].tsMs <= target) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

// Index of first row where rows[i].tsMs >= target; rows.length if none.
function ceilIdx(rows: PhRow[], target: number): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].tsMs < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Override application and self-check ───────────────────────────────────────

export function applyAndVerifyOverrides(overrides: ReplayOverrides): void {
  if (Object.keys(overrides).filter(k => overrides[k as keyof ReplayOverrides] !== undefined).length === 0) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cfg = require("@/lib/agent/config") as Record<string, unknown>;

  if (overrides.STALE_EXIT_HOURS !== undefined)          cfg["STALE_EXIT_HOURS"]           = overrides.STALE_EXIT_HOURS;
  if (overrides.TAKE_PROFIT_DISTANCE_PCT !== undefined)  cfg["TAKE_PROFIT_DISTANCE_PCT"]   = overrides.TAKE_PROFIT_DISTANCE_PCT;
  if (overrides.STALE_EXIT_MIN_PROFIT_PCT !== undefined) cfg["STALE_EXIT_MIN_PROFIT_PCT"]  = overrides.STALE_EXIT_MIN_PROFIT_PCT;

  // ── Self-check probes — one per overridden field ──────────────────────────
  //
  // Each probe is designed so: WITH the override → expected status.
  // If the module patch failed to reach checkExit, the status differs and we abort.
  // Note: probes for TAKE_PROFIT_DISTANCE_PCT and STALE_EXIT_MIN_PROFIT_PCT are
  // most reliable when the override widens the threshold (lower than default).
  // For overrides in the opposite direction both with/without patch give the same
  // result, but the probe still catches the common failure (wrong key name, no
  // mutation reaching rules.ts).

  const probeNow = new Date(2026, 0, 10, 12, 0, 0);

  function failProbe(field: string, override: unknown, got: string, expected: string): never {
    console.error(
      `\n[replay] *** OVERRIDE SELF-CHECK FAILED ***\n` +
      `  Applied ${field} = ${String(override)}\n` +
      `  checkExit returned '${got}' — expected '${expected}'\n` +
      `  Module patch did not reach rules.ts. Aborting.\n`,
    );
    process.exit(1);
  }

  // 1. STALE_EXIT_HOURS — hold (override + 0.1)h in profit → stale_exit
  if (overrides.STALE_EXIT_HOURS !== undefined) {
    const hoursToProbe = overrides.STALE_EXIT_HOURS + 0.1;
    const entry        = 0.9950;
    const minProfit    = (overrides.STALE_EXIT_MIN_PROFIT_PCT ?? STALE_EXIT_MIN_PROFIT_PCT) + 0.0001;
    const probePrice   = entry * (1 + minProfit);
    const probeOpened  = new Date(probeNow.getTime() - hoursToProbe * 3_600_000);

    const probe = checkExit(
      { coin: "usdc", peg: 1.0, entry, sizeUsd: 1000, openedAt: probeOpened, rulesVersion: "v3.1" },
      probePrice,
      probeNow,
    );
    if (probe.status !== "stale_exit") failProbe("STALE_EXIT_HOURS", overrides.STALE_EXIT_HOURS, probe.status, "stale_exit");
    console.log(`[replay] Override self-check passed (STALE_EXIT_HOURS=${overrides.STALE_EXIT_HOURS} → stale_exit)`);
  }

  // 2. TAKE_PROFIT_DISTANCE_PCT — price just above new take-profit threshold → won
  //    Probe price = peg*(1 - override) + ε, held 1h (not stale, not timed out).
  //    The imported TAKE_PROFIT_DISTANCE_PCT still holds the pre-patch value; if
  //    the probe price exceeds both old and new thresholds the check is a no-op,
  //    but it will catch a wrong key name or a completely failed patch.
  if (overrides.TAKE_PROFIT_DISTANCE_PCT !== undefined) {
    const entry      = 0.9920; // well inside dip zone
    const probePrice = 1.0 * (1 - overrides.TAKE_PROFIT_DISTANCE_PCT) + 0.0001;
    const probeOpened = new Date(probeNow.getTime() - 1 * 3_600_000); // 1h ago

    if (probePrice > entry) { // sanity: price recovered above entry
      const probe = checkExit(
        { coin: "usdc", peg: 1.0, entry, sizeUsd: 1000, openedAt: probeOpened, rulesVersion: "v3.1" },
        probePrice,
        probeNow,
      );
      if (probe.status !== "won") failProbe("TAKE_PROFIT_DISTANCE_PCT", overrides.TAKE_PROFIT_DISTANCE_PCT, probe.status, "won");
      console.log(`[replay] Override self-check passed (TAKE_PROFIT_DISTANCE_PCT=${overrides.TAKE_PROFIT_DISTANCE_PCT} → won)`);
    } else {
      console.warn(`[replay] TAKE_PROFIT_DISTANCE_PCT self-check skipped: override (${overrides.TAKE_PROFIT_DISTANCE_PCT}) would set take-profit below entry price`);
    }
  }

  // 3. STALE_EXIT_MIN_PROFIT_PCT — hold past stale threshold, price = entry*(1+override+ε) → stale_exit
  //    Uses the already-overridden STALE_EXIT_HOURS if set, otherwise the pre-patch default.
  if (overrides.STALE_EXIT_MIN_PROFIT_PCT !== undefined) {
    const staleHours  = (overrides.STALE_EXIT_HOURS ?? STALE_EXIT_HOURS) + 0.1;
    const entry       = 0.9950;
    const probePrice  = entry * (1 + overrides.STALE_EXIT_MIN_PROFIT_PCT + 0.0001);
    const probeOpened = new Date(probeNow.getTime() - staleHours * 3_600_000);

    const probe = checkExit(
      { coin: "usdc", peg: 1.0, entry, sizeUsd: 1000, openedAt: probeOpened, rulesVersion: "v3.1" },
      probePrice,
      probeNow,
    );
    if (probe.status !== "stale_exit") failProbe("STALE_EXIT_MIN_PROFIT_PCT", overrides.STALE_EXIT_MIN_PROFIT_PCT, probe.status, "stale_exit");
    console.log(`[replay] Override self-check passed (STALE_EXIT_MIN_PROFIT_PCT=${overrides.STALE_EXIT_MIN_PROFIT_PCT} → stale_exit)`);
  }

  console.log("[replay] Overrides applied:", overrides);
}

// ── Main simulation loop ──────────────────────────────────────────────────────

export function runReplay(
  datasets: CoinDataset[],
  overrides: ReplayOverrides = {},
  options: RunReplayOptions = {},
): ReplayResult {
  applyAndVerifyOverrides(overrides);
  const debugDecisions: DebugDecision[] = [];

  // Build 5-minute grid across all coins' data range (mirrors live cron cadence)
  let gridStart = Infinity, gridEnd = -Infinity;
  for (const ds of datasets) {
    if (ds.rows.length > 0) {
      if (ds.rows[0].tsMs < gridStart)                        gridStart = ds.rows[0].tsMs;
      if (ds.rows[ds.rows.length - 1].tsMs > gridEnd) gridEnd = ds.rows[ds.rows.length - 1].tsMs;
    }
  }
  if (!isFinite(gridStart)) throw new Error("No ticks in data — did the download succeed?");

  const ticks: number[] = [];
  for (let t = gridStart; t <= gridEnd; t += TICK_INTERVAL_MS) ticks.push(t);

  // Warm-up: no buys for the first 7 days of the grid
  const warmupEndMs = gridStart + 7 * 24 * 60 * 60 * 1000;

  // Per-coin running state
  const runningLastAtPeg = new Map<string, number | null>();
  const lastRowIdx       = new Map<string, number>();
  for (const ds of datasets) {
    runningLastAtPeg.set(ds.slug, ds.seedLastAtPegMs);
    lastRowIdx.set(ds.slug, -1);
  }

  // Simulation state
  const openTrades   = new Map<string, SimTrade>();
  const closed: ClosedTrade[] = [];
  // Per-coin last-saved decision + timestamp — mirrors what live reads from agent_trades
  const lastDecision = new Map<string, { decision: string; tsMs: number }>();

  let slotFullTicks   = 0;
  let postWarmupTicks = 0;

  for (const tickMs of ticks) {
    const now = new Date(tickMs);

    // ── Advance running last_at_peg for each coin ────────────────────────────
    // Mirrors SQL: last timestamp WHERE ABS(deviation_bps) < 50
    // Null deviation_bps rows are skipped (SQL WHERE ignores NULLs).
    for (const ds of datasets) {
      let idx = lastRowIdx.get(ds.slug) ?? -1;
      while (idx + 1 < ds.rows.length && ds.rows[idx + 1].tsMs <= tickMs) {
        idx++;
        const dev = ds.rows[idx].deviation_bps;
        if (dev !== null && Math.abs(dev) < 50) {
          const prev = runningLastAtPeg.get(ds.slug) ?? null;
          if (prev === null || ds.rows[idx].tsMs > prev) {
            runningLastAtPeg.set(ds.slug, ds.rows[idx].tsMs);
          }
        }
      }
      lastRowIdx.set(ds.slug, idx);
    }

    // ── Step 1: Check exits for open trades ──────────────────────────────────
    for (const [slug, trade] of openTrades) {
      const ds = datasets.find(d => d.slug === slug);
      if (!ds) continue;
      const ci = floorIdx(ds.rows, tickMs);
      if (ci < 0) continue;
      const currentPrice = ds.rows[ci].price;

      const openTrade: OpenTrade = {
        coin:         trade.coin,
        peg:          trade.peg,
        entry:        trade.entry,
        sizeUsd:      trade.sizeUsd,
        openedAt:     trade.openedAt,
        rulesVersion: trade.rulesVersion,
      };

      const exit = checkExit(openTrade, currentPrice, now);
      if (exit.status !== "open") {
        openTrades.delete(slug);
        closed.push({
          coin:        slug,
          entryTs:     trade.openedAt,
          exitTs:      now,
          entryPrice:  trade.entry,
          exitPrice:   exit.exitPrice,
          hoursHeld:   (tickMs - trade.openedAt.getTime()) / 3_600_000,
          sizeUsd:     trade.sizeUsd,
          pnlUsd:      exit.profitUsd,
          exitReason:  exit.status,
        });
      }
    }

    const isPostWarmup = tickMs >= warmupEndMs;
    if (isPostWarmup) {
      postWarmupTicks++;
      if (openTrades.size >= 3) slotFullTicks++; // MAX_OPEN_POSITIONS = 3
    }
    if (!isPostWarmup) continue;

    // ── Step 2: Evaluate all coins (mirrors runner.ts — open-trade coins still
    //    evaluated; only buys are blocked by the open-trade guard below) ────────
    let openPositionsCount = openTrades.size; // let — incremented as buys open this tick

    for (const ds of datasets) {
      const ci = floorIdx(ds.rows, tickMs);
      if (ci < 0) continue;
      const price    = ds.rows[ci].price;
      const { peg }  = ds;
      const depegPct = (peg - price) / peg;

      // Mirrors shouldRecord(): skip coins not in the dip zone
      if (depegPct < DIP_ZONE_START_PCT) continue;

      // ── Build HistoryStats (mirrors runner.ts / coin_history_stats RPC) ────

      const lastAtPegMs = runningLastAtPeg.get(ds.slug) ?? null;
      const firstSeenMs = ds.firstSeenMs;

      let hoursOffPeg: number | null = null;
      if (lastAtPegMs !== null) {
        hoursOffPeg = (tickMs - lastAtPegMs) / 3_600_000;
      } else {
        hoursOffPeg = (tickMs - firstSeenMs) / 3_600_000;
      }

      const { rows } = ds;

      // price_1h_ago / price_24h_ago
      const i1h  = floorIdx(rows, tickMs - 3_600_000);
      const i24h = floorIdx(rows, tickMs - 86_400_000);
      const p1h  = i1h  >= 0 ? rows[i1h].price  : null;
      const p24h = i24h >= 0 ? rows[i24h].price : null;

      // low_24h: min price in [tickMs - 24h, tickMs]
      const lo24Start = ceilIdx(rows, tickMs - 86_400_000);
      let low24h: number | null = null;
      for (let i = lo24Start; i <= ci; i++) {
        if (low24h === null || rows[i].price < low24h) low24h = rows[i].price;
      }

      // pct_below_7d: ROUND(100 * COUNT(deviation_bps <= -50) / COUNT(*), 1)
      // Null rows count in COUNT(*) but not in the numerator — matches SQL semantics.
      const lo7dStart = ceilIdx(rows, tickMs - 7 * 86_400_000);
      let belowCount = 0, totalCount = 0;
      for (let i = lo7dStart; i <= ci; i++) {
        totalCount++; // COUNT(*) — includes null deviation_bps
        const dev7d = rows[i].deviation_bps;
        if (dev7d !== null && dev7d <= -50) belowCount++;
      }
      const pctBelow7d = totalCount > 0
        ? Math.round(100 * belowCount / totalCount * 10) / 10
        : null;

      const daysOfData = (tickMs - firstSeenMs) / 86_400_000;

      const evidence: Evidence = {
        coin:                    ds.slug,
        peg,
        medianPrice:             price,
        // Two identical sources → sourceCount=2, spread=0 → sourcesAgree=true.
        // The live bot sees 2-5 agreeing price feeds; one replay source forces every
        // dip-zone coin to "avoid" via the !sourcesAgree guard in decide()/canBuy.
        pricesBySource: { replay_1: price, replay_2: price },
        largeTransferCount24h:   0,                  // not simulated
        largeTransferTotalUsd24h: 0,                 // not simulated
        openPositionsCount,
        tier:                    getCoinTier(ds.slug),
        history: {
          hoursOffPeg,
          change1hPct:      p1h  ? (price - p1h)  / p1h  : null,
          change24hPct:     p24h ? (price - p24h) / p24h : null,
          bounceFromLowPct: low24h ? (price - low24h) / low24h : null,
          pctBelow7d,
          daysOfData,
          hadPriorDipCycle: null,
          medianPrice7d:    null,
        },
      };

      // v3 extra data: only for coins in the dip zone (not deep depeg)
      const isInDipZoneNow = depegPct >= DIP_ZONE_START_PCT && depegPct <= DEEP_DEPEG_PCT;
      if (isInDipZoneNow) {
        const w7dRows = rows
          .slice(lo7dStart, ci + 1)
          .filter(r => isFinite(r.price));

        if (w7dRows.length > 0) {
          evidence.history!.medianPrice7d    = computeMedian(w7dRows.map(r => r.price));
          evidence.history!.hadPriorDipCycle = computeHadPriorDipCycle(w7dRows, tickMs, peg);
        }

        evidence.livesBelowPeg =
          evidence.history!.medianPrice7d !== null &&
          evidence.history!.medianPrice7d / peg < LIVES_BELOW_PEG_THRESHOLD;
        evidence.livesBelowPegMedian = evidence.history!.medianPrice7d ?? undefined;
        evidence.isRepeatDip         = evidence.history!.hadPriorDipCycle === true;
      }

      const result = decide(evidence);
      const { decision, danger } = result;

      // Record ALL decide() calls when debug mode is on (before dedup filters)
      if (options.debug) {
        debugDecisions.push({
          tsMs: tickMs,
          coin: ds.slug,
          decision,
          dangerReasons: [...danger.reasons],
          dangerScore:   danger.score,
        });
      }

      // ── 6h duplicate-decision guard (mirrors runner.ts lines 306–308) ────────
      // Compares against the last SAVED decision (same logic as live DB lookup).
      // Open-trade coins still reach here so their lastDecision window advances
      // correctly for watch/avoid decisions — mirroring live where those rows
      // are inserted even while a buy is open.
      const prev6h = lastDecision.get(ds.slug);
      if (prev6h && prev6h.decision === decision && prev6h.tsMs > tickMs - 6 * 3_600_000) continue;

      // ── Open-trade guard (mirrors runner.ts line 311) ────────────────────────
      // Only blocks buy; watch/avoid fall through and update lastDecision below.
      if (decision === "buy" && openTrades.has(ds.slug)) continue;

      // Decision passes both filters — record it (mirrors successful DB insert)
      lastDecision.set(ds.slug, { decision, tsMs: tickMs });

      if (decision === "buy" && result.buy) {
        openTrades.set(ds.slug, {
          coin:         ds.slug,
          peg,
          entry:        result.buy.entry,
          sizeUsd:      result.buy.sizeUsd,
          openedAt:     now,
          rulesVersion: RULES_VERSION,
        });
        openPositionsCount++;
      }
    }
  }

  return {
    closed,
    stillOpen:      [...openTrades.values()],
    slotFullTicks,
    postWarmupTicks,
    debugDecisions,
  };
}
