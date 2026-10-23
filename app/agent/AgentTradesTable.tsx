"use client";

import { Fragment, useState, useMemo } from "react";
import type { AgentTrade, AgentSummary } from "./page";
import AgentReplay from "./AgentReplay";

type Filter = "trades" | "skipped" | "all";

const PAGE_SIZE = 50;

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

function tradeResultStr(trade: AgentTrade): string | null {
  if (trade.decision !== "buy" || trade.size_usd === null) return null;
  const sizeStr = `$${trade.size_usd.toLocaleString()}`;
  if (trade.status === "open") return `${sizeStr} · OPEN`;
  if (trade.pnl_usd === null) return sizeStr;
  const pct = (trade.pnl_usd / trade.size_usd) * 100;
  const pctSign = pct >= 0 ? "+" : "";
  return `${sizeStr} → ${pnlStr(trade.pnl_usd)} (${pctSign}${pct.toFixed(2)}%)`;
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

function formatExact(dateStr: string): string {
  return new Date(dateStr).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function holdTime(trade: AgentTrade): string | null {
  if (!trade.closed_at) return null;
  const diff =
    new Date(trade.closed_at).getTime() - new Date(trade.decided_at).getTime();
  if (diff <= 0) return null;
  const hrs = diff / 3_600_000;
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)} days`;
}

function exitLine(trade: AgentTrade): string | null {
  if (trade.decision !== "buy") return null;
  if (!["won", "lost", "timed_out", "stale_exit"].includes(trade.status)) return null;

  const exitP = `$${price4(trade.exit_price)}`;
  const when = trade.closed_at ? ` (${formatExact(trade.closed_at)})` : "";
  const hold = holdTime(trade);
  const duration = hold ? ` · held ${hold}` : "";

  switch (trade.status) {
    case "won":
      return `Sold at ${exitP} — hit target $${price4(trade.target_price)}${when}${duration}`;
    case "lost":
      return `Stopped out at ${exitP}${when}${duration}`;
    case "timed_out":
      return `Closed after 7-day time limit at ${exitP}${when}`;
    case "stale_exit":
      return `Stale exit at ${exitP}${when}${duration}`;
    default:
      return null;
  }
}

const DECISION_STYLE: Record<string, { bg: string; color: string }> = {
  buy:   { bg: "#052e16", color: "#4ade80" },
  watch: { bg: "#2d2500", color: "#fbbf24" },
  avoid: { bg: "#450a0a", color: "#f87171" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:       { bg: "#1e3a5f", color: "#60a5fa" },
  won:        { bg: "#052e16", color: "#4ade80" },
  lost:       { bg: "#450a0a", color: "#f87171" },
  timed_out:  { bg: "#431407", color: "#fb923c" },
  stale_exit: { bg: "#0d2d2d", color: "#2dd4bf" },
  none:       { bg: "#1e293b", color: "#475569" },
};

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: "4px",
        letterSpacing: "0.5px",
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          display: "inline-block",
          width: "60px",
          height: "5px",
          background: "#0f172a",
          borderRadius: "3px",
          overflow: "hidden",
          verticalAlign: "middle",
        }}
      >
        <span
          style={{
            display: "block",
            width: `${score}%`,
            height: "100%",
            background: color,
            borderRadius: "3px",
          }}
        />
      </span>
      <span style={{ fontSize: "11px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
        {score}/100
      </span>
    </span>
  );
}

function ExpandedDetail({ trade, now }: { trade: AgentTrade; now: number }) {
  const ev = trade.evidence as EvidenceShape;
  const dangerReasons: string[] = Array.isArray(trade.danger_reasons) ? trade.danger_reasons : [];
  const oppReasons: string[] = Array.isArray(trade.opportunity_reasons)
    ? trade.opportunity_reasons
    : [];
  const sources = ev?.pricesBySource ?? {};
  const hist = ev?.history;
  const sourceEntries = Object.entries(sources);
  const exit = exitLine(trade);

  return (
    <div
      style={{
        background: "#0d1829",
        borderTop: "1px solid #1e293b",
        padding: "16px 20px 20px",
      }}
    >
      {/* Exact decision time */}
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
        Decided {formatExact(trade.decided_at)}
      </div>

      {/* Exit explanation (closed buy trades) */}
      {exit && (
        <div
          style={{
            background: "#0f172a",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "14px",
            fontSize: "12px",
            color: "#94a3b8",
            wordBreak: "break-word",
            lineHeight: "1.6",
          }}
        >
          {trade.entry_price !== null && (
            <span style={{ color: "#cbd5e1" }}>
              Entry ${price4(trade.entry_price)} →{" "}
            </span>
          )}
          {exit}
        </div>
      )}

      {/* Open trade status */}
      {trade.status === "open" && trade.decision === "buy" && (
        <div
          style={{
            background: "#0f172a",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "14px",
            fontSize: "12px",
            color: "#60a5fa",
            wordBreak: "break-word",
            lineHeight: "1.6",
          }}
        >
          Open for {openDuration(trade.decided_at, now)}
        </div>
      )}

      {/* Position box — all buy rows */}
      {trade.decision === "buy" &&
        (trade.size_usd !== null ||
          trade.entry_price !== null ||
          trade.target_price !== null ||
          trade.stop_price !== null) && (
          <div
            style={{
              background: "#0f172a",
              borderRadius: "6px",
              padding: "10px 14px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#4b5563",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Position
            </div>
            <div style={{ display: "flex", gap: "8px 24px", flexWrap: "wrap" }}>
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
            </div>
          </div>
        )}

      {/* mkUSD liquidity disclaimer */}
      {trade.coin === "mkusd" && (
        <div
          style={{
            background: "#111827",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "14px",
            fontSize: "11px",
            color: "#6b7280",
            lineHeight: "1.6",
          }}
        >
          mkUSD has very low real liquidity (no major exchange listings), so these trades
          couldn&apos;t be filled at size in practice. Counted as practice only.
        </div>
      )}

      {/* Danger + Opportunity — 2-col on desktop, 1-col on mobile */}
      <div className="agent-expanded-grid">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", letterSpacing: "0.5px" }}
            >
              DANGER
            </span>
            <ScoreBar score={trade.danger_score} color="#f87171" />
          </div>
          {dangerReasons.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#4b5563", margin: 0 }}>No danger signals</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {dangerReasons.map((r, i) => (
                <li key={i} style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: "11px", fontWeight: 700, color: "#4ade80", letterSpacing: "0.5px" }}
            >
              OPPORTUNITY
            </span>
            <ScoreBar score={trade.opportunity_score} color="#4ade80" />
          </div>
          {oppReasons.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#4b5563", margin: 0 }}>No opportunity signals</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {oppReasons.map((r, i) => (
                <li key={i} style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Evidence */}
      <div style={{ borderTop: "1px solid #1e293b", marginTop: "14px", paddingTop: "12px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#4b5563",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Evidence
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {sourceEntries.length > 0 && (
            <div style={{ fontSize: "11px", color: "#94a3b8", wordBreak: "break-word" }}>
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
                  {" "}(${(ev.largeTransferTotalUsd24h / 1_000_000).toFixed(0)}M)
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
                  {" · "}1h {hist.change1hPct >= 0 ? "+" : ""}
                  {(hist.change1hPct * 100).toFixed(2)}%
                </span>
              )}
              {hist.change24hPct !== null && (
                <span style={{ color: hist.change24hPct >= 0 ? "#4ade80" : "#f87171" }}>
                  {" · "}24h {hist.change24hPct >= 0 ? "+" : ""}
                  {(hist.change24hPct * 100).toFixed(2)}%
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

          <div style={{ fontSize: "11px", color: "#334155" }}>rules {trade.rules_version}</div>
        </div>
      </div>
    </div>
  );
}

function TradeCard({
  trade,
  now,
  isExpanded,
  onToggle,
}: {
  trade: AgentTrade;
  now: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isBuy = trade.decision === "buy";
  const decStyle = DECISION_STYLE[trade.decision] ?? DECISION_STYLE.watch;
  const statStyle = STATUS_STYLE[trade.status] ?? STATUS_STYLE.none;
  const pnlColor =
    trade.pnl_usd === null ? "#4b5563" : trade.pnl_usd >= 0 ? "#4ade80" : "#f87171";

  return (
    <div
      style={{
        background: isExpanded ? "#162032" : "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        marginBottom: "8px",
        opacity: isBuy ? 1 : 0.55,
        overflow: "hidden",
      }}
    >
      <div onClick={onToggle} style={{ padding: "12px 14px", cursor: "pointer" }}>
        {/* Coin + badges row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>
            {trade.coin.toUpperCase()}
          </span>
          {trade.coin === "mkusd" && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: "3px",
                letterSpacing: "0.5px",
                background: "#1e293b",
                color: "#475569",
                border: "1px solid #334155",
              }}
            >
              PAPER ONLY
            </span>
          )}
          <Badge label={trade.decision.toUpperCase()} style={decStyle} />
          {trade.status !== "none" && (
            <Badge
              label={trade.status.replace("_", " ").toUpperCase()}
              style={statStyle}
            />
          )}
          <span
            style={{ marginLeft: "auto", fontSize: "10px", color: "#4b5563", flexShrink: 0 }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        </div>

        {/* Price + time row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <span>${price4(trade.price)}</span>
          <span>{timeAgo(trade.decided_at, now)}</span>
        </div>
        {/* Trade result row — buy rows only */}
        {isBuy && (() => {
          const result = tradeResultStr(trade);
          if (!result) return null;
          const resultColor = trade.status === "open" ? "#60a5fa" : pnlColor;
          return (
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: resultColor,
                marginTop: "4px",
                wordBreak: "break-word",
              }}
            >
              {result}
            </div>
          );
        })()}
      </div>

      {isExpanded && <ExpandedDetail trade={trade} now={now} />}
    </div>
  );
}

const TAB_LABELS: Record<Filter, string> = {
  trades:  "Trades",
  skipped: "Skipped",
  all:     "All",
};

const RESPONSIVE_CSS = `
  .agent-page-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 24px;
  }
  .agent-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .agent-table-wrapper { display: block; }
  .agent-card-list     { display: none;  }
  .agent-expanded-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 639px) {
    .agent-page-inner {
      padding: 24px 16px;
    }
    .agent-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .agent-table-wrapper { display: none;  }
    .agent-card-list     { display: block; }
    .agent-expanded-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default function AgentTradesTable({
  trades,
  summary,
}: {
  trades: AgentTrade[];
  summary: AgentSummary;
}) {
  const [filter, setFilter] = useState<Filter>("trades");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const now = useMemo(() => Date.now(), []);

  const filtered = useMemo(() => {
    if (filter === "trades") return trades.filter((t) => t.decision === "buy");
    if (filter === "skipped")
      return trades.filter((t) => t.decision === "avoid" || t.decision === "watch");
    return trades;
  }, [trades, filter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setExpandedId(null);
    setVisibleCount(PAGE_SIZE);
  };

  const pnlColor = summary.realisedPnl >= 0 ? "#4ade80" : "#f87171";

  const nonMkusdStats = useMemo(() => {
    const rows = trades.filter(
      (t) => t.decision === "buy" && t.coin !== "mkusd" && t.status !== "none"
    );
    return {
      total:    rows.length,
      won:      rows.filter((t) => t.status === "won").length,
      lost:     rows.filter((t) => t.status === "lost").length,
      timedOut: rows.filter((t) => t.status === "timed_out" || t.status === "stale_exit").length,
      pnl:      rows.reduce((acc, t) => acc + (t.pnl_usd ?? 0), 0),
    };
  }, [trades]);

  const tradeSizeLabel = useMemo(() => {
    const sizes = trades
      .filter((t) => t.decision === "buy" && t.size_usd !== null)
      .map((t) => t.size_usd as number);
    if (sizes.length === 0) return null;
    const max = Math.max(...sizes);
    const min = Math.min(...sizes);
    if (max === min) return `$${max.toLocaleString()} per trade`;
    return `up to $${max.toLocaleString()} per trade`;
  }, [trades]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "monospace",
        overflowX: "hidden",
      }}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />

      <div className="agent-page-inner">
        {/* Title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: "0 0 6px" }}>
            PegCheck Agent — Practice Trades
          </h1>
          <p style={{ fontSize: "12px", color: "#475569", margin: 0, fontStyle: "italic" }}>
            Practice trades with pretend money. Not financial advice.
          </p>
        </div>

        {/* Summary cards */}
        <div className="agent-summary-grid">
          {(() => {
            const pnlPct = summary.bankroll > 0
              ? (summary.realisedPnl / summary.bankroll) * 100 : 0;
            const pnlPctStr = `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% of bankroll`;
            return [
              { label: "Bankroll",      value: `$${summary.bankroll.toLocaleString()}`, color: "#f1f5f9", sub: tradeSizeLabel,  subColor: "#4b5563" },
              { label: "Open trades",   value: String(summary.openCount),               color: "#60a5fa", sub: null,            subColor: null      },
              { label: "Closed trades", value: String(summary.closedCount),             color: "#94a3b8", sub: null,            subColor: null      },
              { label: "Realised P&L",  value: pnlStr(summary.realisedPnl),            color: pnlColor,  sub: pnlPctStr,       subColor: pnlColor  },
            ];
          })().map(({ label, value, color, sub, subColor }) => (
            <div
              key={label}
              style={{
                background: "#1e293b",
                borderRadius: "10px",
                padding: "16px 20px",
                border: "1px solid #334155",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#4b5563",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value}
              </div>
              {sub && (
                <div style={{ fontSize: "11px", color: subColor ?? "#4b5563", marginTop: "4px" }}>
                  {sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Honest headline — non-mkusd stats */}
        {nonMkusdStats.total > 0 && (
          <p
            style={{
              fontSize: "11px",
              color: "#475569",
              margin: "-16px 0 20px",
              lineHeight: "1.6",
            }}
          >
            Excluding mkUSD:{" "}
            <span style={{ color: "#94a3b8" }}>{nonMkusdStats.total} trades</span>,{" "}
            <span style={{ color: "#4ade80" }}>{nonMkusdStats.won} won</span>,{" "}
            <span style={{ color: "#f87171" }}>{nonMkusdStats.lost} lost</span>
            {nonMkusdStats.timedOut > 0 && (
              <span style={{ color: "#fb923c" }}> ({nonMkusdStats.timedOut} timed out)</span>
            )},{" "}
            <span style={{ color: nonMkusdStats.pnl >= 0 ? "#4ade80" : "#f87171" }}>
              {pnlStr(nonMkusdStats.pnl)}
            </span>
            {summary.bankroll > 0 && (
              <span style={{ color: "#4b5563" }}>
                {" "}({(() => {
                  const p = (nonMkusdStats.pnl / summary.bankroll) * 100;
                  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
                })()} of bankroll)
              </span>
            )}
          </p>
        )}

        <AgentReplay />

        {/* Tab buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          {(["trades", "skipped", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
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
              {TAB_LABELS[f]}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#4b5563" }}>
            {visible.length} of {filtered.length}
          </span>
        </div>

        {/* ── Card list (mobile ≤639px) ── */}
        <div className="agent-card-list">
          {visible.length === 0 ? (
            <p
              style={{ fontSize: "13px", color: "#4b5563", textAlign: "center", marginTop: "48px" }}
            >
              No records yet.
            </p>
          ) : (
            visible.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                now={now}
                isExpanded={expandedId === trade.id}
                onToggle={() =>
                  setExpandedId(expandedId === trade.id ? null : trade.id)
                }
              />
            ))
          )}
        </div>

        {/* ── Table (desktop ≥640px) ── */}
        <div className="agent-table-wrapper">
          {visible.length === 0 ? (
            <p
              style={{ fontSize: "13px", color: "#4b5563", textAlign: "center", marginTop: "48px" }}
            >
              No records yet.
            </p>
          ) : (
            <div
              style={{
                background: "#1e293b",
                borderRadius: "10px",
                border: "1px solid #334155",
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "720px",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155" }}>
                      {["Coin", "Decision", "Price", "Entry", "Exit", "P&L", "Status", "Time"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#4b5563",
                              letterSpacing: "1px",
                              textTransform: "uppercase",
                              padding: "12px 14px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((trade) => {
                      const isExpanded = expandedId === trade.id;
                      const isBuy = trade.decision === "buy";
                      const decStyle = DECISION_STYLE[trade.decision] ?? DECISION_STYLE.watch;
                      const statStyle = STATUS_STYLE[trade.status] ?? STATUS_STYLE.none;
                      const rowPnlColor =
                        trade.pnl_usd === null ? "#4b5563"
                        : trade.pnl_usd >= 0   ? "#4ade80"
                        :                        "#f87171";
                      const rowResult = tradeResultStr(trade);
                      const rowResultColor = isBuy && trade.status === "open" ? "#60a5fa" : rowPnlColor;

                      return (
                        <Fragment key={trade.id}>
                          <tr
                            onClick={() =>
                              setExpandedId(isExpanded ? null : trade.id)
                            }
                            style={{
                              borderBottom: isExpanded ? "none" : "1px solid #1e293b",
                              cursor: "pointer",
                              opacity: isBuy ? 1 : 0.45,
                              background: isExpanded ? "#162032" : "transparent",
                              transition: "background 0.1s",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "13px",
                                color: "#e2e8f0",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span style={{ marginRight: "6px", fontSize: "9px", color: "#4b5563" }}>
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              {trade.coin.toUpperCase()}
                              {trade.coin === "mkusd" && (
                                <span
                                  style={{
                                    marginLeft: "6px",
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    letterSpacing: "0.5px",
                                    background: "#0f172a",
                                    color: "#475569",
                                    border: "1px solid #334155",
                                  }}
                                >
                                  PAPER ONLY
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                              <Badge label={trade.decision.toUpperCase()} style={decStyle} />
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "12px",
                                color: "#94a3b8",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ${price4(trade.price)}
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "12px",
                                color: "#cbd5e1",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {trade.entry_price !== null
                                ? `$${price4(trade.entry_price)}`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "12px",
                                color: "#cbd5e1",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {trade.exit_price !== null
                                ? `$${price4(trade.exit_price)}`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "12px",
                                fontVariantNumeric: "tabular-nums",
                                color: rowResultColor,
                              }}
                            >
                              {rowResult ?? pnlStr(trade.pnl_usd)}
                            </td>
                            <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                              <Badge
                                label={trade.status.replace("_", " ").toUpperCase()}
                                style={statStyle}
                              />
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                fontSize: "11px",
                                color: "#4b5563",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {timeAgo(trade.decided_at, now)}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr
                              style={{
                                borderBottom: "1px solid #1e293b",
                                opacity: isBuy ? 1 : 0.45,
                              }}
                            >
                              <td colSpan={8} style={{ padding: 0 }}>
                                <ExpandedDetail trade={trade} now={now} />
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

        {/* Load more */}
        {hasMore && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#94a3b8",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
