export const COIN_PEGS: Record<string, number> = {
  usdt: 1.0,  usdc: 1.0,   dai:    1.0,  usds:   1.0,
  ethena: 1.0, pyusd: 1.0, fdusd:  1.0,  rlusd:  1.0,
  tusd: 1.0,  frax: 1.0,   gho:    1.0,  crvusd: 1.0,
  lusd: 1.0,  usdp: 1.0,   usdd:   1.0,  mkusd:  1.0,
  eurc: 1.16, dola: 1.0,   alusd:  1.0,  bold:   1.0,
  usdg: 1.0,  usd1: 1.0,   u:      1.0,  usdgo:  1.0,
  usdf: 1.0,
};

// Per-coin deviation bands (as a fraction of peg).
// Group A – major fiat-backed, deep liquidity:      ±20 bps healthy / ±50 bps caution
// Group B – DeFi / synthetic / newer fiat-backed:   ±30 bps healthy / ±100 bps caution
// Group C – high-variance synthetic / DeFi:         ±50 bps healthy / ±150 bps caution
export const COIN_THRESHOLDS: Record<string, { healthy: number; caution: number }> = {
  // Group C – high-variance
  lusd:   { healthy: 0.005, caution: 0.015 },
  mkusd:  { healthy: 0.005, caution: 0.015 },
  alusd:  { healthy: 0.005, caution: 0.015 },
  // Group B – DeFi / synthetic / newer
  ethena: { healthy: 0.003, caution: 0.010 },
  frax:   { healthy: 0.003, caution: 0.010 },
  gho:    { healthy: 0.003, caution: 0.010 },
  crvusd: { healthy: 0.003, caution: 0.010 },
  usdd:   { healthy: 0.003, caution: 0.010 },
  eurc:   { healthy: 0.003, caution: 0.010 },
  dola:   { healthy: 0.003, caution: 0.010 },
  bold:   { healthy: 0.003, caution: 0.010 },
  usdf:   { healthy: 0.003, caution: 0.010 },
  u:      { healthy: 0.003, caution: 0.010 },
  usdgo:  { healthy: 0.003, caution: 0.010 },
  usd1:   { healthy: 0.003, caution: 0.010 },
  // Group A – major fiat-backed (all others fall back to DEFAULT_THRESHOLDS)
};

// Default = Group A: ±20 bps healthy / ±50 bps caution
export const DEFAULT_THRESHOLDS = { healthy: 0.002, caution: 0.005 };

export function getThresholds(slug: string) {
  return COIN_THRESHOLDS[slug] ?? DEFAULT_THRESHOLDS;
}
