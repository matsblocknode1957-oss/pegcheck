import { REPEAT_DIP_WINDOW_HOURS, DIP_ZONE_START_PCT } from "./config";

export function computeMedian(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

// Returns true when: a dip-zone reading exists before the most recent at-peg timestamp,
// both within the REPEAT_DIP_WINDOW_HOURS window from nowMs.
// Returns false when data exists but no such cycle is found.
// Returns null when rows is empty (caller should treat as unavailable).
export function computeHadPriorDipCycle(
  rows: Array<{ created_at: string; price: number }>,
  nowMs: number,
  peg: number,
): boolean | null {
  if (rows.length === 0) return null;

  const windowMs = REPEAT_DIP_WINDOW_HOURS * 60 * 60 * 1000;
  const dipWindowStart = nowMs - windowMs;

  const sorted = rows
    .map(r => ({ ts: Date.parse(r.created_at), price: r.price }))
    .sort((a, b) => a.ts - b.ts);

  // Find the most recent timestamp where the coin was within the peg zone
  let lastAtPegTs: number | null = null;
  for (const e of sorted) {
    if (Math.abs(e.price - peg) / peg < DIP_ZONE_START_PCT) {
      if (lastAtPegTs === null || e.ts > lastAtPegTs) lastAtPegTs = e.ts;
    }
  }

  // No recovery found, or recovery is older than the repeat-dip window
  if (lastAtPegTs === null || nowMs - lastAtPegTs >= windowMs) return false;

  // Was there a dip-zone reading before that recovery, within the window?
  for (const e of sorted) {
    if (e.ts >= lastAtPegTs) break; // sorted ascending — nothing earlier follows
    if (e.ts < dipWindowStart) continue;
    if ((peg - e.price) / peg >= DIP_ZONE_START_PCT) return true;
  }

  return false;
}
