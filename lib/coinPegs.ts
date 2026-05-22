export const COIN_PEGS: Record<string, number> = {
  usdt: 1.0,
  usdc: 1.0,
  usds: 1.0,
  ethena: 1.0,
  pyusd: 1.0,
  fdusd: 1.0,
  rlusd: 1.0,
  tusd: 1.0,
  frax: 1.0,
  gho: 1.0,
  crvusd: 1.0,
  lusd: 1.0,
  usdp: 1.0,
  usdd: 1.0,
  mkusd: 1.0,
  eurc: 1.13,
  dola: 1.0,
  alusd: 1.0,
  bold: 1.0,
};

export const COIN_THRESHOLDS: Record<string, { healthy: number; caution: number }> = {
  lusd:  { healthy: 0.005, caution: 0.015 },
  mkusd: { healthy: 0.005, caution: 0.015 },
};

export const DEFAULT_THRESHOLDS = { healthy: 0.001, caution: 0.005 };

export function getThresholds(slug: string) {
  return COIN_THRESHOLDS[slug] ?? DEFAULT_THRESHOLDS;
}
