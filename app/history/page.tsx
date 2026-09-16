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

export default async function HistoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const slugList = COINS.map((c) => c.slug);

  const [{ data: atlRows, error: atlError }, { data: depegRows, error: depegError }] =
    await Promise.all([
      supabase.rpc("coin_atl_stats", { slugs: slugList }),
      supabase.rpc("depeg_events", { min_price_usd: 0.999, eurc_max_price: 1.1287, gap_hours: 6 }),
    ]);

  if (atlError)   console.error("coin_atl_stats error:", JSON.stringify(atlError));
  if (depegError) console.error("depeg_events error:",  JSON.stringify(depegError));

  const summaryResults: SummaryItem[] = COINS.map((coin) => {
    const row = (atlRows ?? []).find(
      (r: { slug: string; atl: number; atl_date: string; avg_dev: number }) =>
        r.slug === coin.slug
    );
    return {
      slug:    coin.slug,
      name:    coin.name,
      icon:    coin.icon,
      bgColor: coin.bgColor,
      atl:     row ? Number(row.atl)     : (COIN_PEGS[coin.slug] ?? 1.0),
      atlDate: row?.atl_date ?? null,
      avgDev:  row ? Number(row.avg_dev) : 0,
    };
  });

  const now = Date.now();
  const depegEvents: DepegEvent[] = (depegRows ?? []).map(
    (r: { slug: string; start_date: string; end_date: string; lowest_price: number; duration_hours: number }) => ({
      slug:          r.slug,
      coinName:      COINS.find((c) => c.slug === r.slug)?.name ?? r.slug.toUpperCase(),
      startDate:     r.start_date,
      durationHours: Number(r.duration_hours),
      lowestPrice:   Number(r.lowest_price),
      recovered:     now - new Date(r.end_date).getTime() > 6 * 3_600_000,
    })
  );

  return <HistoryContent summaryResults={summaryResults} depegEvents={depegEvents} />;
}
