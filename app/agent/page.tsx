import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import AgentTradesTable from "./AgentTradesTable";
import { BANKROLL_USD } from "@/lib/agent/config";

export const dynamic = "force-dynamic";

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

  // Summary from ALL rows (no limit), status <> 'none' — gives correct totals
  const { data: summaryRows, error: summaryError } = await supabase
    .from("agent_trades")
    .select("status, pnl_usd")
    .eq("mode", "live")
    .neq("status", "none");

  if (summaryError) console.error("agent_trades summary error:", JSON.stringify(summaryError));

  const allRows = summaryRows ?? [];
  const openCount = allRows.filter((r) => r.status === "open").length;
  const closedRows = allRows.filter((r) =>
    ["won", "lost", "timed_out", "stale_exit"].includes(r.status)
  );
  const realisedPnl = closedRows.reduce((acc: number, r) => acc + ((r.pnl_usd as number) ?? 0), 0);

  const summary: AgentSummary = {
    bankroll: BANKROLL_USD,
    openCount,
    closedCount: closedRows.length,
    realisedPnl,
  };

  const DISPLAY_COLS =
    "id, decided_at, coin, chain, peg, price, decision, danger_score, opportunity_score, danger_reasons, opportunity_reasons, evidence, rules_version, summary, status, size_usd, entry_price, target_price, stop_price, exit_price, pnl_usd, closed_at";

  // ALL buy rows — no limit so every trade ever made is visible on the Trades tab
  const { data: buyData, error: buyError } = await supabase
    .from("agent_trades")
    .select(DISPLAY_COLS)
    .eq("mode", "live")
    .eq("decision", "buy")
    .order("decided_at", { ascending: false });

  if (buyError) console.error("agent_trades buy error:", JSON.stringify(buyError));

  // Newest 200 skip rows (avoid / watch)
  const { data: skipData, error: skipError } = await supabase
    .from("agent_trades")
    .select(DISPLAY_COLS)
    .eq("mode", "live")
    .in("decision", ["avoid", "watch"])
    .order("decided_at", { ascending: false })
    .limit(200);

  if (skipError) console.error("agent_trades skip error:", JSON.stringify(skipError));

  // Merge and sort newest-first for the All tab
  const merged = [...(buyData ?? []), ...(skipData ?? [])].sort(
    (a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime()
  );

  const trades: AgentTrade[] = merged as AgentTrade[];

  return <AgentTradesTable trades={trades} summary={summary} />;
}
