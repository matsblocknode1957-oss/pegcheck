"use client";
import { useState } from "react";
import HistoryChart from "./HistoryChart";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";
import type { SummaryItem, DepegEvent } from "./page";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(hours: number): string {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function atlBadge(atl: number, peg: number, slug: string) {
  const { healthy, caution } = getThresholds(slug);
  const diff = Math.abs(atl - peg) / peg;
  if (diff <= healthy) return { color: "#16a34a", bg: "#052e16", label: "Stable" };
  if (diff <= caution) return { color: "#d97706", bg: "#451a03", label: "Caution" };
  return { color: "#dc2626", bg: "#450a0a", label: "Depeg" };
}

interface Props {
  summaryResults: SummaryItem[];
  depegEvents: DepegEvent[];
}

export default function HistoryContent({ summaryResults, depegEvents }: Props) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pegcheck-dark") === "true";
    }
    return true;
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (typeof window !== "undefined") localStorage.setItem("pegcheck-dark", String(next));
  };

  const bg           = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg     = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg       = dark ? "#0d1628" : "#ffffff";
  const cardBorder   = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary  = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const tableHeaderBg = dark ? "#080e1a" : "#f9fafb";
  const navBg        = dark ? "#0d1628" : "#ffffff";
  const navBorder    = dark ? "#1e2a40" : "#eaecf0";
  const divider      = dark ? "#1e2a40" : "#e5e7eb";

  const hallOfFame = [...summaryResults].sort((a, b) => b.atl - a.atl);
  const mostStable = [...summaryResults]
    .filter((c) => c.avgDev > 0)
    .sort((a, b) => a.avgDev - b.avgDev)
    .slice(0, 5);

  const rankColors = ["#f59e0b", "#9ca3af", "#b45309", textSecondary, textSecondary];

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px", transition: "background 0.2s ease" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: "16px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
          <div style={{ width: "38px", height: "38px", flexShrink: 0, background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "15px" }}>P✓</div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: textPrimary, lineHeight: "1.2" }}>PegCheck</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "2px" }}>Depeg History</div>
          </div>
        </a>
        <button
          onClick={toggleDark}
          aria-label="Toggle theme"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "8px", color: textSecondary, display: "flex", alignItems: "center" }}
        >
          {dark ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Hall of Fame ── */}
      <div style={{ padding: "20px 20px 12px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>Stability Rankings</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Coins ranked by all-time low — #1 never dropped far from peg, worst at the bottom.</div>
      </div>

      <div style={{ background: tableHeaderBg, borderTop: `1px solid ${divider}`, borderBottom: `1px solid ${divider}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 88px 80px 72px", padding: "8px 20px", columnGap: "8px" }}>
          {["#", "Coin", "ATL Price", "Date", "vs Peg"].map((h) => (
            <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</span>
          ))}
        </div>
      </div>

      {hallOfFame.map((coin, i) => {
        const peg = COIN_PEGS[coin.slug] ?? 1.0;
        const pctFromPeg = ((peg - coin.atl) / peg) * 100;
        const { healthy, caution } = getThresholds(coin.slug);
        const absDiff = Math.abs(coin.atl - peg) / peg;
        const rowColor = absDiff > caution ? "#dc2626" : absDiff > healthy ? "#d97706" : "#16a34a";
        return (
          <div key={coin.slug} style={{ display: "grid", gridTemplateColumns: "28px 1fr 88px 80px 72px", padding: "11px 20px", borderBottom: `1px solid ${cardBorder}`, background: cardBg, alignItems: "center", columnGap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: rankColors[i] ?? textSecondary, fontFamily: "monospace" }}>{i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                <img src={coin.icon} alt={coin.name} width={14} height={14} style={{ objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coin.name}</span>
            </div>
            <span style={{ fontSize: "13px", fontFamily: "monospace", fontWeight: "700", color: rowColor }}>${coin.atl.toFixed(4)}</span>
            <span style={{ fontSize: "11px", color: textSecondary }}>{coin.atlDate ? formatDate(coin.atlDate) : "—"}</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "600", color: rowColor }}>
              {pctFromPeg > 0.001 ? `-${pctFromPeg.toFixed(2)}%` : pctFromPeg < -0.001 ? `+${Math.abs(pctFromPeg).toFixed(2)}%` : "0.00%"}
            </span>
          </div>
        );
      })}

      {/* ── Most Stable ── */}
      {mostStable.length > 0 && (
        <>
          <div style={{ height: "1px", background: divider }} />
          <div style={{ padding: "20px 20px 12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>Most Stable</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Top 5 coins by lowest average deviation from peg across all recorded history.</div>
          </div>

          <div style={{ background: tableHeaderBg, borderTop: `1px solid ${divider}`, borderBottom: `1px solid ${divider}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 100px 80px", padding: "8px 20px", columnGap: "8px" }}>
              {["#", "Coin", "Avg Deviation", "Rating"].map((h) => (
                <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</span>
              ))}
            </div>
          </div>

          {mostStable.map((coin, i) => {
            const pctDev = coin.avgDev * 100;
            const devColor = pctDev < 0.02 ? "#16a34a" : pctDev < 0.1 ? "#d97706" : "#dc2626";
            const rating = pctDev < 0.02 ? "Excellent" : pctDev < 0.1 ? "Good" : "Fair";
            const ratingBg = pctDev < 0.02 ? (dark ? "#052e16" : "#f0fdf4") : pctDev < 0.1 ? (dark ? "#451a03" : "#fffbeb") : (dark ? "#450a0a" : "#fef2f2");
            return (
              <div key={coin.slug} style={{ display: "grid", gridTemplateColumns: "28px 1fr 100px 80px", padding: "11px 20px", borderBottom: `1px solid ${cardBorder}`, background: cardBg, alignItems: "center", columnGap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: rankColors[i] ?? textSecondary, fontFamily: "monospace" }}>{i + 1}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    <img src={coin.icon} alt={coin.name} width={14} height={14} style={{ objectFit: "contain" }} />
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coin.name}</span>
                </div>
                <span style={{ fontSize: "13px", fontFamily: "monospace", fontWeight: "700", color: devColor }}>{pctDev.toFixed(4)}%</span>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: ratingBg, color: devColor, display: "inline-block", whiteSpace: "nowrap" }}>{rating}</span>
              </div>
            );
          })}
        </>
      )}

      <div style={{ height: "1px", background: divider }} />

      {/* ── All-Time Lows Cards ── */}
      <div style={{ padding: "20px 20px 12px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>All-Time Lows</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "0 20px 24px" }}>
        {summaryResults.map((coin) => {
          const badge = atlBadge(coin.atl, COIN_PEGS[coin.slug] ?? 1.0, coin.slug);
          return (
            <div key={coin.slug} style={{ flex: "1 1 140px", background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={coin.icon} alt={coin.name} width={18} height={18} style={{ objectFit: "contain" }} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.name}</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "700", color: badge.color }}>
                ${coin.atl.toFixed(4)}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: textSecondary }}>{coin.atlDate ? formatDate(coin.atlDate) : "—"}</span>
                <span style={{ padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: "1px", background: divider, margin: "0 20px" }} />

      {/* ── Price History Chart ── */}
      <div style={{ padding: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "14px" }}>Price History</div>
        <HistoryChart coins={summaryResults.map((c) => ({ slug: c.slug, name: c.name }))} dark={dark} />
      </div>

      <div style={{ height: "1px", background: divider, margin: "0 20px" }} />

      {/* ── Depeg Events ── */}
      <div style={{ padding: "20px 20px 8px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>Depeg Events</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginBottom: "12px" }}>
          Records where price fell below $0.9990 (or equivalent for non-USD pegs), grouped by continuity (gap &gt; 6h = new event). Sorted newest first.
        </div>
      </div>

      {depegEvents.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: textSecondary, fontSize: "13px" }}>
          No depeg events recorded.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 58px 76px 84px", padding: "8px 20px", background: tableHeaderBg, borderTop: `1px solid ${divider}`, borderBottom: `1px solid ${divider}` }}>
            {["Coin", "Date", "Duration", "Low", "Recovery"].map((h) => (
              <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</span>
            ))}
          </div>
          {depegEvents.map((event, i) => {
            const meta = summaryResults.find((c) => c.slug === event.slug);
            return (
              <div key={`${event.slug}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 90px 58px 76px 84px", padding: "12px 20px", borderBottom: `1px solid ${cardBorder}`, background: cardBg, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  {meta && (
                    <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: meta.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      <img src={meta.icon} alt={event.coinName} width={14} height={14} style={{ objectFit: "contain" }} />
                    </div>
                  )}
                  <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{event.coinName}</span>
                </div>
                <span style={{ fontSize: "11px", color: textSecondary }}>{formatDate(event.startDate)}</span>
                <span style={{ fontSize: "11px", color: textSecondary, fontFamily: "monospace" }}>{formatDuration(event.durationHours)}</span>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "700", color: "#dc2626" }}>${event.lowestPrice.toFixed(4)}</span>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: event.recovered ? (dark ? "#052e16" : "#f0fdf4") : (dark ? "#451a03" : "#fffbeb"), color: event.recovered ? "#16a34a" : "#d97706", display: "inline-block" }}>
                  {event.recovered ? "Recovered" : "Ongoing"}
                </span>
              </div>
            );
          })}
        </>
      )}

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>Alerts</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>History</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>About</span>
        </a>
      </div>

    </main>
  );
}
