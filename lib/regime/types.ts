export interface PricePoint {
  created_at: string;
  deviation_bps: number; // signed: (price - peg) / peg * 10000
}

export interface WindowFeatures {
  monotonicity_score: number;    // 0–1: fraction of steps where |deviation| is non-decreasing
  recovery_completeness: number; // 0–1: (peak_sev - current_sev) / peak_sev
  early_late_ratio: number;      // mean_sev(first 25%) / mean_sev(last 25%)
  deterioration_run: number;     // hours: longest run of non-decreasing severity
  velocity: number;              // bps/h: signed slope of deviation_bps over window
  acceleration: number;          // bps/h²: change in velocity from first→second half
  oscillation_depth: number;     // bps: std-dev of signed deviation_bps
  max_severity: number;          // bps: max |deviation_bps| in window
  current_severity: number;      // bps: |deviation_bps| at last record
  persistence: number;           // 0–1: fraction of records with severity > 20 bps
  window_hours: number;          // actual window duration in hours
}

export type LayerARegime =
  | "REFLEXIVE_COLLAPSE"
  | "COLLATERAL_SHOCK"
  | "CONTAINED_STRESS"
  | "LIQUIDITY_DISLOCATION"
  | "NONE";

export type LayerBTrajectory =
  | "STABLE"
  | "DRIFT"
  | "WOBBLE"
  | "SLIDE"
  | "BREAK"
  | "WHIPSAW";

export interface RegimeClassification {
  layer_a: LayerARegime;
  layer_b: LayerBTrajectory;
  confidence: number; // 0–100
  features: WindowFeatures;
  timestamp: string;
}

export interface BacktestRow {
  coin: string;
  event_start: string;
  event_end: string | null;
  peak_severity_bps: number;
  layer_a: LayerARegime;
  layer_b_at_break: LayerBTrajectory;
  confidence_at_break: number;
  first_warning: "SLIDE" | "WOBBLE" | null;
  hours_lead: number | null;
}
