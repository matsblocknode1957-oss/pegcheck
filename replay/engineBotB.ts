/**
 * Bot B (Bold) replay engine.
 *
 * Same detection / entry signals as Bot A (decide() from rules.ts).
 * Differences vs Bot A:
 *   - Split buys: $500 first half; second $500 if price falls SPLIT_BUY_DROP_PCT below entry
 *   - Depth: entry >= DEEP_ENTRY_PCT below peg OR second half filled → "deep"
 *   - Shallow: Bot A take-profit distance, stale exit at SHALLOW_STALE_EXIT_HOURS
 *   - Deep:    take-profit at peg*(1-DEEP_TAKE_PROFIT_DISTANCE_PCT), stale at DEEP_STALE_EXIT_HOURS
 *   - Trailing: once target hit, hold while rising, exit on TRAILING_PULLBACK_PCT pullback from peak
 *   - Safety exits (stop-loss 3%, max-hold 7d) identical to Bot A
 *   - SWAP_FEE_PCT applied per buy and per sell
 *
 * lib/agent/ is imported read-only — no behaviour changes to the live bot.
 */

import { decide, Evidence } from "@/lib/agent/rules";
import { computeMedian, computeHadPriorDipCycle } from "@/lib/agent/history";
import {
  DIP_ZONE_START_PCT,
  DEEP_DEPEG_PCT,
  STOP_LOSS_PCT,
  MAX_TRADE_DAYS,
  LIVES_BELOW_PEG_THRESHOLD,
  getCoinTier,
} from "@/lib/agent/config";
import { loadDatasets, applyAndVerifyOverrides } from "./engine";
import type { ClosedTrade } from "./engine";

const TICK_INTERVAL_MS = 5 * 60 * 1000;
const HALF_SIZE_USD    = 500;

// ── Public types ──────────────────────────────────────────────────────────────

export interface BotBConfig {
  SWAP_FEE_PCT: number;
  SPLIT_BUY_DROP_PCT: number;
  DEEP_ENTRY_PCT: number;
  SHALLOW_STALE_EXIT_HOURS: number;
  DEEP_STALE_EXIT_HOURS: number;
  STALE_EXIT_MIN_PROFIT_PCT: number;
  SHALLOW_TAKE_PROFIT_DISTANCE_PCT: number;
  DEEP_TAKE_PROFIT_DISTANCE_PCT: number;
  TRAILING_PULLBACK_PCT: number;
}

export interface ClosedBotBTrade extends ClosedTrade {
  doubled: boolean;
}

export interface BotBReplayResult {
  closed: ClosedBotBTrade[];
  stillOpen: BotBTrade[];
  slotFullTicks: number;
  postWarmupTicks: number;
  maxCapitalUsd: number;
}

// ── Internal types ────────────────────────────────────────────────────────────

export interface BotBTrade {
  coin: string;
  peg: number;
  entry1: number;
  size1: number;        // always HALF_SIZE_USD
  openedAt: Date;
  doubled: boolean;
  entry2: number | null;
  size2: number;        // HALF_SIZE_USD once doubled, else 0
  doubledAt: Date | null;
  isDeep: boolean;
  targetHit: boolean;
  highSinceTarget: number;
  takeProfit: number;
  stopLoss: number;
  staleHours: number;
}

// ── Binary search helpers (mirrors engine.ts) ─────────────────────────────────

function floorIdx(rows: Array<{ tsMs: number }>, target: number): number {
  let lo = 0, hi = rows.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].tsMs <= target) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

function ceilIdx(rows: Array<{ tsMs: number }>, target: number): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].tsMs < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Per-tick exit logic ───────────────────────────────────────────────────────

function stepBotBTrade(
  trade: BotBTrade,
  currentPrice: number,
  now: Date,
  cfg: BotBConfig,
): { reason: string } | null {
  const hoursHeld = (now.getTime() - trade.openedAt.getTime()) / 3_600_000;

  if (currentPrice <= trade.stopLoss) return { reason: "lost" };
  if (hoursHeld >= MAX_TRADE_DAYS * 24) return { reason: "timed_out" };

  if (trade.targetHit) {
    if (currentPrice > trade.highSinceTarget) trade.highSinceTarget = currentPrice;
    if (currentPrice <= trade.highSinceTarget * (1 - cfg.TRAILING_PULLBACK_PCT)) {
      return { reason: "won" };
    }
    return null;
  }

  if (currentPrice >= trade.takeProfit) {
    trade.targetHit = true;
    trade.highSinceTarget = currentPrice;
    return null;
  }

  // Stale exit only before trailing mode
  const avgEntry = trade.doubled
    ? (trade.size1 * trade.entry1 + trade.size2 * trade.entry2!) / (trade.size1 + trade.size2)
    : trade.entry1;
  if (
    hoursHeld >= trade.staleHours &&
    currentPrice >= avgEntry * (1 + cfg.STALE_EXIT_MIN_PROFIT_PCT)
  ) {
    return { reason: "stale_exit" };
  }

  return null;
}

// ── Main simulation loop ──────────────────────────────────────────────────────

export function runReplayBotB(
  datasets: ReturnType<typeof loadDatasets>,
  cfg: BotBConfig,
): BotBReplayResult {
  // Reset tunables so decide() uses live defaults (same entry signals as Bot A)
  applyAndVerifyOverrides({});

  let gridStart = Infinity, gridEnd = -Infinity;
  for (const ds of datasets) {
    if (ds.rows.length > 0) {
      if (ds.rows[0].tsMs < gridStart)                        gridStart = ds.rows[0].tsMs;
      if (ds.rows[ds.rows.length - 1].tsMs > gridEnd) gridEnd = ds.rows[ds.rows.length - 1].tsMs;
    }
  }
  if (!isFinite(gridStart)) throw new Error("No ticks in data");

  const ticks: number[] = [];
  for (let t = gridStart; t <= gridEnd; t += TICK_INTERVAL_MS) ticks.push(t);
  const warmupEndMs = gridStart + 7 * 24 * 60 * 60 * 1000;

  const runningLastAtPeg = new Map<string, number | null>();
  const lastRowIdx       = new Map<string, number>();
  for (const ds of datasets) {
    runningLastAtPeg.set(ds.slug, ds.seedLastAtPegMs);
    lastRowIdx.set(ds.slug, -1);
  }

  const openTrades   = new Map<string, BotBTrade>();
  const closed: ClosedBotBTrade[] = [];
  const lastDecision = new Map<string, { decision: string; tsMs: number }>();

  let slotFullTicks   = 0;
  let postWarmupTicks = 0;
  let maxCapitalUsd   = 0;

  for (const tickMs of ticks) {
    const now = new Date(tickMs);

    // ── Advance running last_at_peg (mirrors engine.ts exactly) ─────────────
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

    // ── Step 1: Double-fill check + exits ────────────────────────────────────
    for (const [slug, trade] of openTrades) {
      const ds = datasets.find(d => d.slug === slug);
      if (!ds) continue;
      const ci = floorIdx(ds.rows, tickMs);
      if (ci < 0) continue;
      const currentPrice = ds.rows[ci].price;

      // Double-fill: once per position, upgrade to deep on fill
      if (!trade.doubled && currentPrice <= trade.entry1 * (1 - cfg.SPLIT_BUY_DROP_PCT)) {
        trade.doubled  = true;
        trade.entry2   = currentPrice;
        trade.size2    = HALF_SIZE_USD;
        trade.doubledAt = now;
        trade.isDeep   = true;
        trade.takeProfit = ds.peg * (1 - cfg.DEEP_TAKE_PROFIT_DISTANCE_PCT);
        trade.staleHours = cfg.DEEP_STALE_EXIT_HOURS;
      }

      const outcome = stepBotBTrade(trade, currentPrice, now, cfg);
      if (!outcome) continue;

      openTrades.delete(slug);
      const totalCost = trade.size1 + trade.size2;
      const units     = trade.size1 / trade.entry1 +
                        (trade.doubled ? trade.size2 / trade.entry2! : 0);
      const exitValue = units * currentPrice;
      const buyFees   = totalCost * cfg.SWAP_FEE_PCT;
      const sellFee   = exitValue * cfg.SWAP_FEE_PCT;
      const pnlUsd    = exitValue - totalCost - buyFees - sellFee;
      const avgEntry  = trade.doubled
        ? (trade.size1 * trade.entry1 + trade.size2 * trade.entry2!) / totalCost
        : trade.entry1;

      closed.push({
        coin:       slug,
        entryTs:    trade.openedAt,
        exitTs:     now,
        entryPrice: avgEntry,
        exitPrice:  currentPrice,
        hoursHeld:  (tickMs - trade.openedAt.getTime()) / 3_600_000,
        sizeUsd:    totalCost,
        pnlUsd,
        exitReason: outcome.reason,
        doubled:    trade.doubled,
      });
    }

    const isPostWarmup = tickMs >= warmupEndMs;
    if (isPostWarmup) {
      postWarmupTicks++;
      if (openTrades.size >= 3) slotFullTicks++;
    }
    if (!isPostWarmup) continue;

    // ── Step 2: Evaluate coins (mirrors engine.ts evidence-building exactly) ─
    let openPositionsCount = openTrades.size;

    for (const ds of datasets) {
      const ci = floorIdx(ds.rows, tickMs);
      if (ci < 0) continue;
      const price    = ds.rows[ci].price;
      const { peg }  = ds;
      const depegPct = (peg - price) / peg;

      if (depegPct < DIP_ZONE_START_PCT) continue;

      const lastAtPegMs = runningLastAtPeg.get(ds.slug) ?? null;
      const firstSeenMs = ds.firstSeenMs;
      const hoursOffPeg = lastAtPegMs !== null
        ? (tickMs - lastAtPegMs) / 3_600_000
        : (tickMs - firstSeenMs) / 3_600_000;

      const { rows } = ds;
      const i1h  = floorIdx(rows, tickMs - 3_600_000);
      const i24h = floorIdx(rows, tickMs - 86_400_000);
      const p1h  = i1h  >= 0 ? rows[i1h].price  : null;
      const p24h = i24h >= 0 ? rows[i24h].price : null;

      const lo24Start = ceilIdx(rows, tickMs - 86_400_000);
      let low24h: number | null = null;
      for (let i = lo24Start; i <= ci; i++) {
        if (low24h === null || rows[i].price < low24h) low24h = rows[i].price;
      }

      const lo7dStart = ceilIdx(rows, tickMs - 7 * 86_400_000);
      let belowCount = 0, totalCount = 0;
      for (let i = lo7dStart; i <= ci; i++) {
        totalCount++;
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
        pricesBySource:          { replay_1: price, replay_2: price },
        largeTransferCount24h:   0,
        largeTransferTotalUsd24h: 0,
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

      const isInDipZoneNow = depegPct >= DIP_ZONE_START_PCT && depegPct <= DEEP_DEPEG_PCT;
      if (isInDipZoneNow) {
        const w7dRows = rows.slice(lo7dStart, ci + 1).filter(r => isFinite(r.price));
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
      const { decision } = result;

      const prev6h = lastDecision.get(ds.slug);
      if (prev6h && prev6h.decision === decision && prev6h.tsMs > tickMs - 6 * 3_600_000) continue;
      if (decision === "buy" && openTrades.has(ds.slug)) continue;

      lastDecision.set(ds.slug, { decision, tsMs: tickMs });

      if (decision === "buy") {
        const entry1 = price;
        const isDeep = (peg - entry1) / peg >= cfg.DEEP_ENTRY_PCT;
        openTrades.set(ds.slug, {
          coin:           ds.slug,
          peg,
          entry1,
          size1:          HALF_SIZE_USD,
          openedAt:       now,
          doubled:        false,
          entry2:         null,
          size2:          0,
          doubledAt:      null,
          isDeep,
          targetHit:      false,
          highSinceTarget: 0,
          takeProfit: isDeep
            ? peg * (1 - cfg.DEEP_TAKE_PROFIT_DISTANCE_PCT)
            : peg * (1 - cfg.SHALLOW_TAKE_PROFIT_DISTANCE_PCT),
          stopLoss:   entry1 * (1 - STOP_LOSS_PCT),
          staleHours: isDeep ? cfg.DEEP_STALE_EXIT_HOURS : cfg.SHALLOW_STALE_EXIT_HOURS,
        });
        openPositionsCount++;
      }
    }

    // Track peak capital after all opens this tick
    let tickCap = 0;
    for (const [, t] of openTrades) tickCap += t.size1 + t.size2;
    if (tickCap > maxCapitalUsd) maxCapitalUsd = tickCap;
  }

  return {
    closed,
    stillOpen:      [...openTrades.values()],
    slotFullTicks,
    postWarmupTicks,
    maxCapitalUsd,
  };
}
