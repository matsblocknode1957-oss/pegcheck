"use client";

import { Fragment, useState, useMemo } from "react";
import type { AgentTrade, AgentSummary } from "./page";

type Filter = "all" | "trades" | "avoid";

interface EvidenceShape {
  pricesBySource?: Record<string, number>;
  largeTransferCount24h?: number;
  largeTransferTotalUsd24h?: number;
  history?: {
    hoursOffPeg: number | null;
    change1hPct: number | null;
    change24hPct: number | null;
    bounceFromLowPct: number | null;
    pctBelow7d: number | null;
    daysOfData: number | null;
  };
}

function price4(v: number | null): string {
  return v === null ? "—" : v.toFixed(4);
}

function pnlStr(v: number | null): string {
  if (v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${v.toFixed(2)}`;
}

function timeAgo(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function openDuration(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const hrs = diff / 3_600_000;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)} days`;
}

const DECISION_STYLE: Record<string, { bg: string; color: string }> = {
  buy:   { bg: "#052e16", color: "#4ade80" },
  watch: { bg: "#2d2500", color: "#fbbf24" },
  avoid: { bg: "#450a0a", color: "#f87171" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:      { bg: "#1e3a5f", color: "#60a5fa" },
  won:       { bg: "#052e16", color: "#4ade80" },
  lost:      { bg: "#450a0a", color: "#f87171" },
  timed_out: { bg: "#431407", color: "#fb923c" },
  none:      { bg: "#1e293b", color: "#475569" },
};

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: "4px",
      letterSpacing: "0.5px",
      background: style.bg,
      color: style.color,
    }}>
      {label}
    </span>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        display: "inline-block",
        width: "60px",
        height: "5px",
        background: "#0f172a",
        borderRadius: "3px",
        overflow: "hidden",
        verticalAlign: "middle",
      }}>
        <span style={{
          display: "block",
          width: `${score}%`,
          height: "100%",
          background: color,
          borderRadius: "3px",
        }} />
      </span>
      <span style={{ fontSize: "11px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
        {score}/100
      </span>
    </span>
  );
}

function ExpandedRow({ trade, now }: { trade: AgentTrade; now: number }) {
  const ev = trade.evidence as EvidenceShape;
  const dangerReasons: string[] = Array.isArray(trade.danger_reasons) ? trade.danger_reasons : [];
  const oppReasons: string[] = Array.isArray(trade.opportunity_reasons) ? trade.opportunity_reasons : [];
  const sources = ev?.pricesBySource ?? {};
  const hist = ev?.history;
  const sourceEntries = Object.entries(sources);

  return (
    <div style={{
      background: "#0d1829",
      borderTop: "1px solid #1e293b",
      padding: "16px 20px 20px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Danger */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", letterSpacing: "0.5px" }}>
              DANGER
            </span>
            <ScoreBar score={trade.danger_score} color="#f87171" />
          </div>
          {dangerReasons.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#4b5563", margin: 0 }}>No danger signals</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {dangerReasons.map((r, i) => (
                <li key={i} style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Opportunity */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#4ade80", letterSpacing: "0.5px" }}>
              OPPORTUNITY
            </span>
            <ScoreBar score={trade.opportunity_score} color="#4ade80" />
          </div>
          {oppReasons.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#4b5563", margin: 0 }}>No opportunity signals</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {oppReasons.map((r, i) => (
                <li key={i} style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Position details (buy rows only) */}
      {trade.decision === "buy" && (
        <div style={{ borderTop: "1px solid #1e293b", marginTop: "14px", paddingTop: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
            Position
          </div>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {trade.size_usd !== null && (
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                Size{" "}
                <span style={{ color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                  ${trade.size_usd.toFixed(0)}
                </span>
              </span>
            )}
            {trade.entry_price !== null && (
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                Entry{" "}
                <span style={{ color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                  ${price4(trade.entry_price)}
                </span>
              </span>
            )}
            {trade.target_price !== null && (
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                Target{" "}
                <span style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>
                  ${price4(trade.target_price)}
                </span>
              </span>
            )}
            {trade.stop_price !== null && (
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                Stop{" "}
                <span style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>
                  ${price4(trade.stop_price)}
                </span>
              </span>
            )}
            {trade.status === "open" && (
              <span style={{ fontSize: "12px", color: "#60a5fa" }}>
                Open {openDuration(trade.decided_at, now)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Evidence */}
      <div style={{ borderTop: "1px solid #1e293b", marginTop: "14px", paddingTop: "12px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
          Evidence
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {sourceEntries.length > 0 && (
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              <span style={{ color: "#4b5563" }}>Sources: </span>
              {sourceEntries.map(([src, val], i) => (
                <span key={src}>
                  {i > 0 && <span style={{ color: "#334155" }}> · </span>}
                  <span style={{ color: "#cbd5e1" }}>{src}</span>{" "}
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{val.toFixed(4)}</span>
                </span>
              ))}
            </div>
          )}

          {(ev?.largeTransferCount24h ?? 0) > 0 && (
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              <span style={{ color: "#4b5563" }}>Transfers 24h: </span>
              <span style={{ color: "#fbbf24" }}>{ev.largeTransferCount24h}</span>
              {ev.largeTransferTotalUsd24h !== undefined && (
                <span style={{ color: "#64748b" }}>
                  {" "}(${((ev.largeTransferTotalUsd24h) / 1_000_000).toFixed(0)}M)
                </span>
              )}
            </div>
          )}

          {hist && (
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              <span style={{ color: "#4b5563" }}>History: </span>
              {hist.hoursOffPeg !== null && (
                <span>off peg {hist.hoursOffPeg.toFixed(1)}h</span>
              )}
              {hist.change1hPct !== null && (
                <span style={{ color: hist.change1hPct >= 0 ? "#4ade80" : "#f87171" }}>
                  {" · "}1h {hist.change1hPct >= 0 ? "+" : ""}{(hist.change1hPct * 100).toFixed(2)}%
                </span>
              )}
              {hist.change24hPct !== null && (
                <span style={{ color: hist.change24hPct >= 0 ? "#4ade80" : "#f87171" }}>
                  {" · "}24h {hist.change24hPct >= 0 ? "+" : ""}{(hist.change24hPct * 100).toFixed(2)}%
                </span>
              )}
              {hist.bounceFromLowPct !== null && hist.bounceFromLowPct > 0 && (
                <span style={{ color: "#4ade80" }}>
                  {" · "}bounce +{(hist.bounceFromLowPct * 100).toFixed(2)}%
                </span>
              )}
              {hist.daysOfData !== null && (
                <span style={{ color: "#64748b" }}>
                  {" · "}{hist.daysOfData.toFixed(1)}d of data
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: "11px", color: "#334155" }}>
            rules {trade.rules_version}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentTradesTable({
  trades,
  summary,
}: {
  trades: AgentTrade[];
  summary: AgentSummary;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const now = Date.now();

  const filtered = useMemo(() => {
    if (filter === "trades") return trades.filter((t) => t.decision === "buy");
    if (filter === "avoid") return trades.filter((t) => t.decision === "avoid");
    return trades;
  }, [trades, filter]);

  const pnlColor = summary.realisedPnl >= 0 ? "#4ade80" : "#f87171";

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#f1f5f9",
      fontFamily: "monospace",
      padding: "48px 24px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Title + banner */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: "0 0 6px" }}>
            PegCheck Agent — Practice Trades
          </h1>
          <p style={{ fontSize: "12px", color: "#475569", margin: 0, fontStyle: "italic" }}>
            Practice trades with pretend money. Not financial advice.
          </p>
        </div>

        {/* Summary cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "28px",
        }}>
          {[
            { label: "Bankroll",       value: `$${summary.bankroll.toLocaleString()}`, color: "#f1f5f9" },
            { label: "Open trades",    value: String(summary.openCount),               color: "#60a5fa" },
            { label: "Closed trades",  value: String(summary.closedCount),             color: "#94a3b8" },
            { label: "Realised P&L",   value: pnlStr(summary.realisedPnl),            color: pnlColor  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#1e293b",
              borderRadius: "10px",
              padding: "16px 20px",
              border: "1px solid #334155",
            }}>
              <div style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#4b5563",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}>
                {label}
              </div>
              <div style={{
                fontSize: "20px",
                fontWeight: 700,
                color,
                fontVariantNumeric: "tabular-nums",
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          {(["all", "trades", "avoid"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setExpandedId(null); }}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: filter === f ? "#2563eb" : "#1e293b",
                color: filter === f ? "#fff" : "#94a3b8",
                outline: filter === f ? "none" : "1px solid #334155",
                transition: "background 0.15s",
                fontFamily: "monospace",
              }}
            >
              {f === "all" ? "All" : f === "trades" ? "Trades only" : "Avoid"}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#4b5563" }}>
            {filtered.length} row{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#4b5563", textAlign: "center", marginTop: "48px" }}>
            No records yet.
          </p>
        ) : (
          <div style={{
            background: "#1e293b",
            borderRadius: "10px",
            border: "1px solid #334155",
            overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["Coin", "Decision", "Price", "Entry", "Exit", "P&L", "Status", "Time"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#4b5563",
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        padding: "12px 14px",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trade) => {
                    const isExpanded = expandedId === trade.id;
                    const isBuy = trade.decision === "buy";
                    const decStyle = DECISION_STYLE[trade.decision] ?? DECISION_STYLE.watch;
                    const statStyle = STATUS_STYLE[trade.status] ?? STATUS_STYLE.none;

                    return (
                      <Fragment key={trade.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                          style={{
                            borderBottom: isExpanded ? "none" : "1px solid #1e293b",
                            cursor: "pointer",
                            opacity: isBuy ? 1 : 0.45,
                            background: isExpanded ? "#162032" : "transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          <td style={{ padding: "12px 14px", fontSize: "13px", color: "#e2e8f0", fontWeight: 600, whiteSpace: "nowrap" }}>
                            <span style={{ marginRight: "6px", fontSize: "9px", color: "#4b5563" }}>
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            {trade.coin.toUpperCase()}
                          </td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <Badge label={trade.decision.toUpperCase()} style={decStyle} />
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "#94a3b8", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            ${price4(trade.price)}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "#cbd5e1", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {trade.entry_price !== null ? `$${price4(trade.entry_price)}` : "—"}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "#cbd5e1", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {trade.exit_price !== null ? `$${price4(trade.exit_price)}` : "—"}
                          </td>
                          <td style={{
                            padding: "12px 14px",
                            fontSize: "12px",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                            color: trade.pnl_usd === null ? "#4b5563" : trade.pnl_usd >= 0 ? "#4ade80" : "#f87171",
                          }}>
                            {pnlStr(trade.pnl_usd)}
                          </td>
                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <Badge
                              label={trade.status.replace("_", " ").toUpperCase()}
                              style={statStyle}
                            />
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "11px", color: "#4b5563", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {timeAgo(trade.decided_at, now)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ borderBottom: "1px solid #1e293b", opacity: isBuy ? 1 : 0.45 }}>
                            <td colSpan={8} style={{ padding: 0 }}>
                              <ExpandedRow trade={trade} now={now} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
