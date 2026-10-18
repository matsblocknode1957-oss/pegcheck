export const BANKROLL_USD = 3_000;
export const MAX_POSITION_USD = 1_000;
export const MAX_OPEN_POSITIONS = 3;
export const DIP_ZONE_START_PCT = 0.005;        // 0.5% below peg
export const DEEP_DEPEG_PCT = 0.05;             // over 5% = "real trouble"
export const TAKE_PROFIT_DISTANCE_PCT = 0.002;  // close when within 0.2% of peg
export const STOP_LOSS_PCT = 0.03;              // 3% below entry
export const MAX_TRADE_DAYS = 7;
export const SOURCE_DISAGREE_SPREAD_PCT = 0.01; // 1% spread = unreliable
export const CHRONIC_HOURS = 72;
export const FRESH_DIP_HOURS = 24;
export const FALLING_FAST_PCT = 0.01;
export const FALLING_PCT = 0.005;
export const BOUNCE_PCT = 0.003;
export const MIN_HISTORY_DAYS = 2;
export const RULES_VERSION = "v3.2";

// v3: coin tiers — everything not in BACKED is treated as STRICT
export const BACKED_COINS = new Set([
  "usdc", "usdt", "pyusd", "rlusd", "fdusd", "usdp", "tusd",
  "lusd", "bold", "mkusd", "crvusd", "gho", "dai", "usds",
]);

export function getCoinTier(coin: string): "BACKED" | "STRICT" {
  return BACKED_COINS.has(coin.toLowerCase()) ? "BACKED" : "STRICT";
}

// v3.1: stale exit — close a v3+ trade after STALE_EXIT_HOURS if it's in profit by at least STALE_EXIT_MIN_PROFIT_PCT
export const STALE_EXIT_HOURS           = 36;
export const STALE_EXIT_MIN_PROFIT_PCT  = 0.0005; // 0.05%

// v3: repeat-dip guard (Rule B)
export const REPEAT_DIP_WINDOW_HOURS = 72;
export const REPEAT_DIP_BACKED_MIN_PCT = 0.015; // BACKED coins: only block at ≥1.5% below peg

// v3: lives-below-peg guard — coin's 7-day median must be above this to buy
export const LIVES_BELOW_PEG_THRESHOLD = 0.996;

// Mutable defaults for replay overrides — live code must never write to this.
export const tunables = {
  STALE_EXIT_HOURS,
  STALE_EXIT_MIN_PROFIT_PCT,
  TAKE_PROFIT_DISTANCE_PCT,
};
