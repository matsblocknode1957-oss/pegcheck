import { extractFeatures, linSlope } from "./features";
import type {
  PricePoint, WindowFeatures,
  LayerARegime, LayerBTrajectory, RegimeClassification,
} from "./types";

// BREAK threshold in bps: coins with wider pegs use looser threshold
const BREAK_THRESHOLD_BPS: Record<string, number> = {
  lusd: 150,
  mkusd: 150,
};
const DEFAULT_BREAK_BPS = 250;

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

// Average of condition margins; unmet conditions are excluded from average
function avgMargin(conditions: [boolean, number][]): number {
  const met = conditions.filter(([ok]) => ok);
  if (!met.length) return 0;
  return met.reduce((s, [, m]) => s + clamp01(m), 0) / met.length;
}

// Time (hours) for severity to drop from peak to peak/2 within the window.
// Returns Infinity if recovery hasn't reached half-peak by end of window.
function recoveryHalfLife(records: PricePoint[]): number {
  const sevs = records.map(r => Math.abs(r.deviation_bps));
  const peak = Math.max(...sevs);
  if (peak === 0) return 0;
  const peakIdx = sevs.lastIndexOf(peak);
  const halfTarget = peak / 2;
  for (let i = peakIdx + 1; i < records.length; i++) {
    if (sevs[i] <= halfTarget) {
      return (
        new Date(records[i].created_at).getTime() -
        new Date(records[peakIdx].created_at).getTime()
      ) / 3_600_000;
    }
  }
  return Infinity;
}

function classifyLayerA(
  f: WindowFeatures, records: PricePoint[]
): { regime: LayerARegime; confidence: number } {
  const {
    monotonicity_score, recovery_completeness, early_late_ratio,
    deterioration_run, persistence, max_severity, window_hours,
  } = f;

  const runThreshold = window_hours * 0.25;

  // Sustained monotonic worsening, near peak — trending depeg
  // max_severity >= 50 prevents firing on healthy coins with tiny monotonic fluctuations
  if (
    max_severity >= 50 &&
    monotonicity_score > 0.55 &&
    deterioration_run > runThreshold &&
    recovery_completeness < 0.5
  ) {
    const conf = avgMargin([
      [true, (monotonicity_score - 0.55) / 0.45],
      [true, window_hours > 0 ? (deterioration_run - runThreshold) / Math.max(1, window_hours - runThreshold) : 0],
      [true, (0.5 - recovery_completeness) / 0.5],
    ]);
    return { regime: "REFLEXIVE_COLLAPSE", confidence: Math.round(conf * 100) };
  }

  // Sharp stress event that quickly recovered
  // max_severity >= 30 ensures there was meaningful stress before the recovery
  if (
    max_severity >= 30 &&
    recovery_completeness > 0.7 &&
    early_late_ratio > 2.0 &&
    persistence < 0.35
  ) {
    const conf = avgMargin([
      [true, (recovery_completeness - 0.7) / 0.3],
      [true, Math.min(1, (early_late_ratio - 2.0) / 3.0)],
      [true, (0.35 - persistence) / 0.35],
    ]);
    return { regime: "COLLATERAL_SHOCK", confidence: Math.round(conf * 100) };
  }

  // Moderate, persistent stress with slow recovery
  const rhl = recoveryHalfLife(records);
  if (
    max_severity >= 100 &&
    max_severity <= 1200 &&
    persistence > 0.2 &&
    rhl > 12
  ) {
    // Confidence peaks when centered in the 100–1200 bps range
    const sev_norm = 1 - Math.abs((max_severity - 650) / 550);
    const conf = avgMargin([
      [true, clamp01(sev_norm)],
      [true, (persistence - 0.2) / 0.8],
    ]);
    return { regime: "CONTAINED_STRESS", confidence: Math.round(conf * 100) };
  }

  // Brief, shallow deviation — likely a liquidity imbalance
  if (max_severity < 300 && persistence < 0.15) {
    const conf = avgMargin([
      [true, (300 - max_severity) / 300],
      [true, (0.15 - persistence) / 0.15],
    ]);
    return { regime: "LIQUIDITY_DISLOCATION", confidence: Math.round(conf * 100) };
  }

  return { regime: "NONE", confidence: 0 };
}

function classifyLayerB(
  f: WindowFeatures, records: PricePoint[], slug: string
): { trajectory: LayerBTrajectory; confidence: number } {
  const {
    oscillation_depth, velocity, monotonicity_score,
    max_severity, current_severity,
  } = f;

  const breakThreshold = BREAK_THRESHOLD_BPS[slug] ?? DEFAULT_BREAK_BPS;

  // Slope of |deviation_bps| — positive means severity worsening
  const t0 = new Date(records[0].created_at).getTime();
  const timesH = records.map(r => (new Date(r.created_at).getTime() - t0) / 3_600_000);
  const sev_velocity = linSlope(timesH, records.map(r => Math.abs(r.deviation_bps)));

  const devs = records.map(r => r.deviation_bps);
  const minDev = Math.min(...devs);
  const maxDev = Math.max(...devs);

  // Priority order: BREAK > WHIPSAW > SLIDE > WOBBLE > DRIFT > STABLE

  // Threshold crossed with meaningful momentum
  if (current_severity >= breakThreshold && Math.abs(velocity) > 2) {
    const conf = avgMargin([
      [true, clamp01((current_severity - breakThreshold) / breakThreshold)],
      [true, clamp01((Math.abs(velocity) - 2) / 15)],
    ]);
    return { trajectory: "BREAK", confidence: Math.round(conf * 100) };
  }

  // High oscillation crossing peg in both directions significantly
  if (oscillation_depth > 40 && minDev < -20 && maxDev > 20) {
    const conf = avgMargin([
      [true, clamp01((oscillation_depth - 40) / 60)],
      [true, clamp01(Math.abs(minDev) / 50)],
      [true, clamp01(maxDev / 50)],
    ]);
    return { trajectory: "WHIPSAW", confidence: Math.round(conf * 100) };
  }

  // Severity worsening monotonically, not yet at depeg threshold
  if (sev_velocity > 2 && monotonicity_score > 0.5 && current_severity < breakThreshold) {
    const conf = avgMargin([
      [true, clamp01((sev_velocity - 2) / 10)],
      [true, (monotonicity_score - 0.5) / 0.5],
    ]);
    return { trajectory: "SLIDE", confidence: Math.round(conf * 100) };
  }

  // High oscillation, mean-reverting, bounded within ±60 bps
  if (oscillation_depth > 25 && monotonicity_score < 0.5 && max_severity < 60) {
    const conf = avgMargin([
      [true, clamp01((oscillation_depth - 25) / 25)],
      [true, (0.5 - monotonicity_score) / 0.5],
    ]);
    return { trajectory: "WOBBLE", confidence: Math.round(conf * 100) };
  }

  // Quiet drift — low volatility and small velocity
  if (oscillation_depth < 20 && Math.abs(velocity) < 5) {
    const conf = avgMargin([
      [true, (20 - oscillation_depth) / 20],
      [true, (5 - Math.abs(velocity)) / 5],
    ]);
    return { trajectory: "DRIFT", confidence: Math.round(conf * 100) };
  }

  if (current_severity < 20 && max_severity < 30) {
    return { trajectory: "STABLE", confidence: 80 };
  }

  return { trajectory: "DRIFT", confidence: 25 };
}

export function classify(
  records: PricePoint[],
  slug: string,
  timestamp?: string,
): RegimeClassification {
  const ts = timestamp ?? records.at(-1)?.created_at ?? new Date().toISOString();

  if (records.length < 5) {
    return {
      layer_a: "NONE", layer_b: "STABLE", confidence: 0,
      features: extractFeatures(records), timestamp: ts,
    };
  }

  const features = extractFeatures(records);
  const { regime, confidence: confA } = classifyLayerA(features, records);
  const { trajectory, confidence: confB } = classifyLayerB(features, records, slug);

  const confidence = regime === "NONE"
    ? confB
    : Math.round((confA + confB) / 2);

  return { layer_a: regime, layer_b: trajectory, confidence, features, timestamp: ts };
}
