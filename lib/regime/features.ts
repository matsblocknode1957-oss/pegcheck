import type { PricePoint, WindowFeatures } from "./types";

function mean(vs: number[]): number {
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
}

function stdDev(vs: number[]): number {
  if (vs.length < 2) return 0;
  const m = mean(vs);
  return Math.sqrt(vs.reduce((s, v) => s + (v - m) ** 2, 0) / (vs.length - 1));
}

export function linSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const xm = mean(xs);
  const ym = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
  const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  return den > 1e-10 ? num / den : 0;
}

const EMPTY: WindowFeatures = {
  monotonicity_score: 0, recovery_completeness: 0, early_late_ratio: 1,
  deterioration_run: 0, velocity: 0, acceleration: 0, oscillation_depth: 0,
  max_severity: 0, current_severity: 0, persistence: 0, window_hours: 0,
};

export function extractFeatures(records: PricePoint[]): WindowFeatures {
  const n = records.length;
  if (n < 2) return { ...EMPTY };

  const t0 = new Date(records[0].created_at).getTime();
  const timesH = records.map(r => (new Date(r.created_at).getTime() - t0) / 3_600_000);
  const devs = records.map(r => r.deviation_bps);
  const sevs = devs.map(Math.abs);

  const window_hours = timesH[n - 1];
  const max_severity = Math.max(...sevs);
  const current_severity = sevs[n - 1];

  // fraction of consecutive steps where |deviation| is non-decreasing
  let nd = 0;
  for (let i = 1; i < n; i++) if (sevs[i] >= sevs[i - 1]) nd++;
  const monotonicity_score = nd / (n - 1);

  const recovery_completeness = max_severity > 0
    ? Math.max(0, (max_severity - current_severity) / max_severity)
    : 0;

  const q = Math.max(1, Math.floor(n / 4));
  const mEarly = mean(sevs.slice(0, q));
  const mLate = mean(sevs.slice(-q));
  const early_late_ratio = mLate > 0.1 ? mEarly / mLate : (mEarly > 0 ? 10 : 1);

  // longest consecutive run of non-decreasing severity, in hours
  let maxRun = 0;
  let runStart = 0;
  for (let i = 1; i < n; i++) {
    if (sevs[i] < sevs[i - 1]) {
      maxRun = Math.max(maxRun, timesH[i - 1] - timesH[runStart]);
      runStart = i;
    }
  }
  maxRun = Math.max(maxRun, timesH[n - 1] - timesH[runStart]);

  // velocity: signed slope of deviation_bps over time (bps/h)
  const velocity = linSlope(timesH, devs);

  // acceleration: change in slope between first and second half of window
  const half = Math.max(2, Math.floor(n / 2));
  const v1 = linSlope(timesH.slice(0, half + 1), devs.slice(0, half + 1));
  const v2 = linSlope(timesH.slice(half - 1), devs.slice(half - 1));
  const dt = (timesH[half - 1] - timesH[0]) || 1;
  const acceleration = (v2 - v1) / dt;

  const oscillation_depth = stdDev(devs);
  const persistence = sevs.filter(s => s > 20).length / n;

  return {
    monotonicity_score, recovery_completeness, early_late_ratio,
    deterioration_run: maxRun, velocity, acceleration, oscillation_depth,
    max_severity, current_severity, persistence, window_hours,
  };
}
