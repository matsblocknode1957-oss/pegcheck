import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { COIN_PEGS } from "@/lib/coinPegs";

function scoreBand(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Caution";
  if (score >= 40) return "Elevated Risk";
  if (score >= 20) return "High Risk";
  return "Critical";
}

export async function GET() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const base = `${protocol}://${host}`;

  const [pricesRes, fgRes] = await Promise.allSettled([
    fetch(`${base}/api/prices`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/fear-greed`, { next: { revalidate: 300 } }),
  ]);

  if (pricesRes.status === "rejected" || !pricesRes.value.ok) {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 502 });
  }

  const { prices, eurUsd = 1.13 } = await pricesRes.value.json();

  // Per-coin peg score based on bps deviation
  const coinScores = Object.entries(prices as Record<string, number>).map(([slug, price]) => {
    const peg = slug === "eurc" ? (eurUsd as number) : (COIN_PEGS[slug] ?? 1.0);
    const bps = (Math.abs(price - peg) / peg) * 10000;
    if (bps < 20) return 100;
    if (bps < 50) return 75;
    if (bps < 200) return 25;
    return 0;
  });
  const pegScore = Math.round(coinScores.reduce<number>((total, score) => total + score, 0) / coinScores.length);

  let fearGreedScore: number | null = null;
  if (fgRes.status === "fulfilled" && fgRes.value.ok) {
    const fgData = await fgRes.value.json();
    if (typeof fgData.score === "number") fearGreedScore = fgData.score;
  }

  const score = fearGreedScore !== null
    ? Math.round(0.5 * pegScore + 0.5 * fearGreedScore)
    : pegScore;

  return NextResponse.json({
    score,
    band: scoreBand(score),
    pegScore,
    fearGreedScore,
    timestamp: new Date().toISOString(),
  });
}
