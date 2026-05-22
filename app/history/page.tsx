import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import HistoryContent from "./HistoryContent";
import { COIN_PEGS } from "@/lib/coinPegs";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Depeg History | PegCheck",
  description: "Historical stablecoin depeg events and all-time low prices for USDT, USDC, USDS, TUSD, PYUSD, FDUSD, RLUSD and Ethena.",
};

const COINS = [
  { slug: "usdt",   name: "USDT",   icon: "/icons/usdt.png",   bgColor: "#26a17b" },
  { slug: "usdc",   name: "USDC",   icon: "/icons/usdc.png",   bgColor: "#2775ca" },
  { slug: "usds",   name: "USDS",   icon: "/icons/usds.png",   bgColor: "#f4b731" },
  { slug: "tusd",   name: "TUSD",   icon: "/icons/tusd.png",   bgColor: "#1a3a5c" },
  { slug: "pyusd",  name: "PYUSD",  icon: "/icons/pyusd.png",  bgColor: "#003087" },
  { slug: "fdusd",  name: "FDUSD",  icon: "/icons/fdusd.png",  bgColor: "#1a1a1a" },
  { slug: "rlusd",  name: "RLUSD",  icon: "/icons/rlusd.png",  bgColor: "#346aa9" },
  { slug: "ethena", name: "Ethena", icon: "/icons/ethena.png", bgColor: "#1a1a2e" },
  { slug: "frax",   name: "FRAX",   icon: "/icons/frax.png",   bgColor: "#1c1c1c" },
  { slug: "gho",    name: "GHO",    icon: "/icons/gho.png",    bgColor: "#b6509e" },
  { slug: "crvusd", name: "crvUSD", icon: "/icons/crvusd.png", bgColor: "#3a3a3a" },
  { slug: "lusd",   name: "LUSD",   icon: "/icons/lusd.png",   bgColor: "#2eb6ae" },
  { slug: "usdp",   name: "USDP",   icon: "/icons/usdp.png",   bgColor: "#00735b" },
  { slug: "usdd",   name: "USDD",   icon: "/icons/usdd.png",   bgColor: "#eb0029" },
  { slug: "mkusd",  name: "mkUSD",  icon: "/icons/mkusd.png",  bgColor: "#6b21a8" },
  { slug: "eurc",   name: "EURC",   icon: "/icons/eurc.png",   bgColor: "#2563eb" },
  { slug: "dola",   name: "DOLA",   icon: "/icons/dola.png",   bgColor: "#1e3a5f" },
  { slug: "alusd",  name: "alUSD",  icon: "/icons/alusd.png",  bgColor: "#f59e0b" },
  { slug: "bold",   name: "BOLD",   icon: "/icons/bold.svg",   bgColor: "#0f766e" },
];

export interface SummaryItem {
  slug: string;
  name: string;
  icon: string;
  bgColor: string;
  atl: number;
  atlDate: string | null;
  avgDev: number;
}

export interface DepegEvent {
  slug: string;
  coinName: string;
  startDate: string;
  durationHours: number;
  lowestPrice: number;
  recovered: boolean;
}

function buildEvent(
  slug: string,
  coinName: string,
  records: { price: number; created_at: string }[],
  now: number
): DepegEvent {
  const lowestPrice = Math.min(...records.map((r) => r.price));
  const startDate = records[0].created_at;
  const endDate = records[records.length - 1].created_at;
  const durationHours =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 3_600_000;
  const recovered = now - new Date(endDate).getTime() > 6 * 3_600_000;
  return { slug, coinName, startDate, durationHours, lowestPrice, recovered };
}

function groupDepegEvents(
  records: { slug: string; price: number; created_at: string }[]
): DepegEvent[] {
  if (!records.length) return [];
  const now = Date.now();
  const bySlug = new Map<string, { slug: string; price: number; created_at: string }[]>();
  for (const r of records) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
    bySlug.get(r.slug)!.push(r);
  }
  const events: DepegEvent[] = [];
  for (const [slug, rows] of bySlug) {
    const sorted = rows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const coinName = COINS.find((c) => c.slug === slug)?.name ?? slug.toUpperCase();
    let groupRecords = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const gapHours =
        (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) /
        3_600_000;
      if (gapHours > 6) {
        events.push(buildEvent(slug, coinName, groupRecords, now));
        groupRecords = [sorted[i]];
      } else {
        groupRecords.push(sorted[i]);
      }
    }
    events.push(buildEvent(slug, coinName, groupRecords, now));
  }
  return events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export default async function HistoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [summaryResults, usdDepegResult, eurcDepegResult] = await Promise.all([
    // Single query per coin — fetches all rows so we can derive both ATL and avgDev
    Promise.all(
      COINS.map(async (coin) => {
        const peg = COIN_PEGS[coin.slug] ?? 1.0;
        const { data } = await supabase
          .from("price_history")
          .select("price, created_at")
          .eq("slug", coin.slug)
          .limit(50000);

        const rows = data ?? [];
        let atl = peg;
        let atlDate: string | null = null;
        let devSum = 0;

        for (const row of rows) {
          const p = Number(row.price);
          if (p < atl) { atl = p; atlDate = row.created_at; }
          devSum += Math.abs(p - peg) / peg;
        }

        return {
          slug: coin.slug,
          name: coin.name,
          icon: coin.icon,
          bgColor: coin.bgColor,
          atl,
          atlDate,
          avgDev: rows.length > 0 ? devSum / rows.length : 0,
        } as SummaryItem;
      })
    ),
    supabase
      .from("price_history")
      .select("slug, price, created_at")
      .neq("slug", "eurc")
      .lt("price", 0.999)
      .order("created_at", { ascending: true }),
    supabase
      .from("price_history")
      .select("slug, price, created_at")
      .eq("slug", "eurc")
      .lt("price", 1.1287)
      .order("created_at", { ascending: true }),
  ]);

  const allDepegRows = [
    ...(usdDepegResult.data ?? []),
    ...(eurcDepegResult.data ?? []),
  ];
  const depegEvents = groupDepegEvents(allDepegRows);

  return <HistoryContent summaryResults={summaryResults} depegEvents={depegEvents} />;
}
