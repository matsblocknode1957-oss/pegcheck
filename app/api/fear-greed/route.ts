import { NextResponse } from "next/server";

function classify(score: number): string {
  if (score <= 24) return "Extreme Fear";
  if (score <= 49) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 74) return "Greed";
  return "Extreme Greed";
}

export async function GET() {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CMC_API_KEY not set" }, { status: 500 });
  }

  const headers = { "X-CMC_PRO_API_KEY": apiKey };

  const [latestRes, histRes] = await Promise.allSettled([
    fetch("https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest", {
      headers,
      next: { revalidate: 300 },
    }),
    fetch("https://pro-api.coinmarketcap.com/v3/fear-and-greed/historical?limit=2", {
      headers,
      next: { revalidate: 300 },
    }),
  ]);

  let score: number | null = null;
  let classification = "";

  if (latestRes.status === "fulfilled" && latestRes.value.ok) {
    const data = await latestRes.value.json();
    score = data?.data?.value ?? null;
    classification = data?.data?.value_classification ?? "";
  }

  let yesterdayScore: number | null = null;
  let yesterdayClassification = "";

  if (histRes.status === "fulfilled" && histRes.value.ok) {
    const data = await histRes.value.json();
    const entries: { value: number; value_classification: string }[] = data?.data ?? [];
    if (entries.length >= 2) {
      yesterdayScore = entries[1]?.value ?? null;
      yesterdayClassification = entries[1]?.value_classification ?? "";
    }
  }

  if (score === null) {
    return NextResponse.json({ error: "Failed to fetch Fear & Greed data" }, { status: 502 });
  }

  return NextResponse.json({
    score,
    classification: classification || classify(score),
    yesterdayScore,
    yesterdayClassification: yesterdayClassification || (yesterdayScore !== null ? classify(yesterdayScore) : ""),
  });
}
