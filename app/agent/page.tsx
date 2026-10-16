import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import AgentTradesTable from "./AgentTradesTable";
import { BANKROLL_USD } from "@/lib/agent/config";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Agent Practice Trades | PegCheck",
  description: "PegCheck Agent practice trading activity — pretend money only.",
  robots: { index: false, follow: false },
};

export interface AgentTrade {
  id: string;
  decided_at: string;
  coin: string;
  chain: string;
  peg: number;
  price: number;
  decision: "buy" | "avoid" | "watch";
  danger_score: number;
  opportunity_score: number;
  danger_reasons: string[];
  opportunity_reasons: string[];
  evidence: Record<string, unknown>;
  rules_version: string;
  summary: string;
  status: "open" | "none" | "won" | "lost" | "timed_out" | "stale_exit";
  size_usd: number | null;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  exit_price: number | null;
  pnl_usd: number | null;
  closed_at: string | null;
}

export interface AgentSummary {
  bankroll: number;
  openCount: number;
  closedCount: number;
  realisedPnl: number;
}

export default async function AgentPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("agent_trades")
    .select(
      "id, decided_at, coin, chain, peg, price, decision, danger_score, opportunity_score, danger_reasons, opportunity_reasons, evidence, rules_version, summary, status, size_usd, entry_price, target_price, stop_price, exit_price, pnl_usd, closed_at"
    )
    .eq("mode", "live")
    .order("decided_at", { ascending: false })
    .limit(200);

  if (error) console.error("agent_trades error:", JSON.stringify(error));

  const trades: AgentTrade[] = (data ?? []) as AgentTrade[];

  const openCount = trades.filter((t) => t.status === "open").length;
  const closedTrades = trades.filter((t) =>
    ["won", "lost", "timed_out", "stale_exit"].includes(t.status)
  );
  const realisedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl_usd ?? 0), 0);

  const summary: AgentSummary = {
    bankroll: BANKROLL_USD,
    openCount,
    closedCount: closedTrades.length,
    realisedPnl,
  };

  return <AgentTradesTable trades={trades} summary={summary} />;
}
