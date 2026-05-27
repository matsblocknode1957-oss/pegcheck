"use client";
import { useState, useEffect, useRef } from "react";

const TIMELINE = [
  {
    label: "09:00  Mar 10", price: 1.0000, status: "Healthy",   freScore: 2,  ccipDelta: 0,
    alert: null,
    narrative: "Silicon Valley Bank announces it has sold $21B in securities at a $1.8B loss to shore up its balance sheet. Depositors begin withdrawing funds. No stablecoin impact yet.",
  },
  {
    label: "10:00  Mar 10", price: 0.9990, status: "Healthy",   freScore: 5,  ccipDelta: 0,
    alert: { sev: "WATCH",    text: "USDC deviation detected — 10 bps below peg. Elevated monitoring." },
    narrative: "Circle discloses $3.3 billion of USDC cash reserves are held at Silicon Valley Bank. Market unease begins as traders assess exposure.",
  },
  {
    label: "11:00  Mar 10", price: 0.9950, status: "Caution",   freScore: 18, ccipDelta: 0,
    alert: { sev: "CAUTION",  text: "USDC −50 bps — caution threshold crossed. Watchlist elevated." },
    narrative: "FDIC takes control of SVB. The bank run accelerates. USDC holders begin to panic sell as uncertainty over Circle's reserves grows.",
  },
  {
    label: "12:00  Mar 10", price: 0.9800, status: "Depeg",     freScore: 42, ccipDelta: 3,
    alert: { sev: "DEPEG",    text: "USDC −200 bps — depeg alert fired. CCIP broadcast to Polygon, Arbitrum, Base." },
    narrative: "USDC enters freefall. Circle unable to confirm full reserve access. Over $1B in USDC redeemed within hours as confidence evaporates.",
  },
  {
    label: "13:00  Mar 10", price: 0.9500, status: "Depeg",     freScore: 62, ccipDelta: 5,
    alert: { sev: "CRITICAL", text: "USDC −500 bps — cascade risk elevated. Emergency cross-chain alerts firing." },
    narrative: "Panic spreads across DeFi. USDC depegs below $0.95 on major exchanges. MakerDAO emergency governance vote proposed to reduce USDC exposure.",
  },
  {
    label: "14:00  Mar 10", price: 0.9100, status: "Critical",  freScore: 78, ccipDelta: 8,
    alert: { sev: "CRITICAL", text: "USDC −900 bps — systemic risk threshold breached. Maximum broadcast active." },
    narrative: "USDC hits $0.91. The Curve 3pool becomes severely imbalanced — over 90% USDC. DAI and USDT trade at large premiums. Systemic contagion risk flagged.",
  },
  {
    label: "15:00  Mar 10", price: 0.8800, status: "Critical",  freScore: 85, ccipDelta: 2,
    alert: { sev: "CRITICAL", text: "USDC $0.88 — worst depeg since Terra UST collapse. FRE score 85/100." },
    narrative: "USDC reaches $0.88 — its lowest price ever. $7B in USDC redemptions queued. Frax, MakerDAO, and Compound face cascading collateral risk.",
  },
  {
    label: "16:00  Mar 10", price: 0.9200, status: "Depeg",     freScore: 72, ccipDelta: 0,
    alert: { sev: "HIGH",     text: "USDC recovering from lows. Fed signals potential SVB depositor backstop." },
    narrative: "Weekend reports emerge that US regulators are considering guaranteeing all SVB deposits. USDC begins cautious recovery from $0.88 lows.",
  },
  {
    label: "17:00  Mar 10", price: 0.9500, status: "Depeg",     freScore: 58, ccipDelta: 0,
    alert: { sev: "HIGH",     text: "USDC −500 bps and improving. Recovery trend confirmed. Risk score declining." },
    narrative: "Circle CEO tweets that USDC liquidity operations will resume Monday. Market confidence begins to stabilise. DeFi protocols start unwinding emergency measures.",
  },
  {
    label: "18:00  Mar 10", price: 0.9800, status: "Caution",   freScore: 32, ccipDelta: 0,
    alert: { sev: "CAUTION",  text: "USDC approaching peg — 200 bps below. Monitoring recovery progress." },
    narrative: "USDC recovers to $0.98 as confidence returns. Curve 3pool begins rebalancing. Frax and MakerDAO emergency proposals pulled as risk recedes.",
  },
  {
    label: "09:00  Mar 11", price: 0.9900, status: "Caution",   freScore: 15, ccipDelta: 0,
    alert: { sev: "WATCH",    text: "USDC −100 bps. Fed BTFP announcement expected Monday. Caution maintained." },
    narrative: "Weekend: US Treasury, Federal Reserve and FDIC jointly announce all SVB depositors will be made whole. USDC stabilises near $0.99.",
  },
  {
    label: "09:00  Mar 13", price: 1.0000, status: "Recovered", freScore: 2,  ccipDelta: 0,
    alert: { sev: "RESOLVED", text: "USDC fully restored to $1.00 peg. FRE score nominal. All-clear issued." },
    narrative: "March 13: The Fed's Bank Term Funding Program (BTFP) goes live. Circle confirms full access to SVB reserves. USDC returns to $1.00. Crisis over.",
  },
];

const MG_ARC = 301.593, MG_CIRC = 402.124;

function freColor(v: number) {
  if (v >= 75) return "#ef4444";
  if (v >= 50) return "#f97316";
  if (v >= 25) return "#eab308";
  return "#22c55e";
}

function statusColor(s: string) {
  if (s === "Recovered") return "#22c55e";
  if (s === "Healthy")   return "#22c55e";
  if (s === "Caution")   return "#f59e0b";
  if (s === "Critical")  return "#ef4444";
  return "#ef4444"; // Depeg
}

function sevColor(sev: string) {
  if (sev === "RESOLVED") return { bg: "rgba(34,197,94,.12)",  fg: "#86efac", bd: "rgba(34,197,94,.3)"  };
  if (sev === "WATCH")    return { bg: "rgba(234,179,8,.12)",  fg: "#fde047", bd: "rgba(234,179,8,.3)"  };
  if (sev === "CAUTION")  return { bg: "rgba(245,158,11,.12)", fg: "#fcd34d", bd: "rgba(245,158,11,.3)" };
  if (sev === "HIGH")     return { bg: "rgba(249,115,22,.12)", fg: "#fdba74", bd: "rgba(249,115,22,.3)" };
  return { bg: "rgba(239,68,68,.12)", fg: "#fca5a5", bd: "rgba(239,68,68,.3)" };
}

export default function SimulatePage() {
  const [step, setStep]       = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ccip, setCcip]       = useState(0);
  const [alerts, setAlerts]   = useState<{ sev: string; text: string; label: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const current = TIMELINE[step];
  const prev    = step > 0 ? TIMELINE[step - 1] : null;
  const portfolioValue = (10000 * current.price).toFixed(2);
  const portfolioLoss  = (10000 - 10000 * current.price).toFixed(2);

  // Advance step
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStep(s => {
          if (s >= TIMELINE.length - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        });
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  // Apply effects when step changes
  useEffect(() => {
    const t = TIMELINE[step];
    if (t.ccipDelta > 0) setCcip(c => c + t.ccipDelta);
    if (t.alert) setAlerts(a => [{ ...t.alert!, label: t.label }, ...a].slice(0, 8));
  }, [step]);

  const reset = () => {
    setPlaying(false);
    setStep(0);
    setCcip(0);
    setAlerts([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const priceColor  = statusColor(current.status);
  const gaugeColor  = freColor(current.freScore);
  const gaugeArc    = ((MG_ARC * current.freScore) / 100).toFixed(2);
  const gaugeGap    = (MG_CIRC - parseFloat(gaugeArc)).toFixed(2);

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#000", minHeight: "100vh", color: "#e0e0e0", paddingBottom: "40px" }}>

      {/* Header */}
      <div style={{ background: "#050505", borderBottom: "1px solid #1a1a1a", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "13px" }}>P✓</div>
            <div>
              <div style={{ fontSize: "17px", fontWeight: "700", color: "#f9fafb" }}>SVB Depeg Simulation</div>
              <div style={{ fontSize: "11px", color: "#6b7280" }}>USDC · March 10–13, 2023</div>
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", background: "rgba(234,179,8,.1)", border: "1px solid rgba(234,179,8,.3)" }}>
            <span style={{ fontSize: "10px" }}>⚠</span>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#fcd34d", letterSpacing: "0.5px" }}>DEMONSTRATION ONLY — NOT REAL DATA</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={step >= TIMELINE.length - 1 && !playing}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "9px 20px", borderRadius: "8px", border: "none",
              background: playing ? "rgba(239,68,68,.15)" : "rgba(34,197,94,.15)",
              color: playing ? "#fca5a5" : "#86efac",
              fontSize: "13px", fontWeight: "700", cursor: "pointer",
              outline: `1px solid ${playing ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.3)"}`,
            }}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={reset}
            style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #1e2a40", background: "transparent", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
          >
            ↺ Reset
          </button>
          <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#444", marginLeft: "4px" }}>
            Step {step + 1} / {TIMELINE.length} · {current.label}
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ background: "#080808", borderBottom: "1px solid #111", padding: "12px 20px", display: "flex", gap: "4px", alignItems: "center" }}>
        {TIMELINE.map((t, i) => {
          const active  = i === step;
          const past    = i < step;
          const c = statusColor(t.status);
          return (
            <button
              key={i}
              onClick={() => { setStep(i); if (i === 0) { setCcip(0); setAlerts([]); } }}
              title={t.label}
              style={{
                flex: 1, height: "6px", borderRadius: "3px", border: "none", cursor: "pointer",
                background: active ? c : past ? c + "66" : "#1a1a1a",
                outline: active ? `1px solid ${c}` : "none",
                transition: "background 0.3s",
              }}
            />
          );
        })}
      </div>

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Row 1: Price + FRE gauge + Portfolio */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>

          {/* Price */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>USDC Price</div>
            <div style={{ fontSize: "52px", fontWeight: "800", fontFamily: "monospace", color: priceColor, lineHeight: 1, transition: "color 0.4s" }}>
              ${current.price.toFixed(4)}
            </div>
            <div style={{ marginTop: "10px" }}>
              <span style={{
                display: "inline-block", padding: "4px 12px", borderRadius: "20px",
                fontSize: "12px", fontWeight: "700",
                background: priceColor + "20", color: priceColor,
                border: `1px solid ${priceColor}44`,
                transition: "all 0.4s",
              }}>
                {current.status}
              </span>
            </div>
            {prev && (
              <div style={{ marginTop: "8px", fontSize: "11px", fontFamily: "monospace", color: current.price < prev.price ? "#ef4444" : "#22c55e" }}>
                {current.price < prev.price ? "▼" : current.price > prev.price ? "▲" : "—"}
                {" "}{Math.abs((current.price - prev.price) * 10000).toFixed(0)} bps
              </div>
            )}
          </div>

          {/* FRE Gauge */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>FRE Risk Score</div>
            <svg width="140" height="140" viewBox="0 0 160 160" style={{ filter: `drop-shadow(0 0 14px ${gaugeColor}44)`, transition: "filter 0.4s" }}>
              <circle cx="80" cy="80" r="64" fill="none" stroke="#141414" strokeWidth="13"
                strokeDasharray="301.59 100.53" strokeLinecap="round" transform="rotate(135 80 80)"/>
              <circle cx="80" cy="80" r="64" fill="none" stroke={gaugeColor} strokeWidth="13"
                strokeDasharray={`${gaugeArc} ${gaugeGap}`} strokeLinecap="round" transform="rotate(135 80 80)"
                style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1), stroke 0.4s" }}/>
              <text x="80" y="75" textAnchor="middle" fontFamily="'Courier New',monospace" fontSize="38" fontWeight="700"
                fill={gaugeColor} style={{ transition: "fill 0.4s" } as React.CSSProperties}>{current.freScore}</text>
              <text x="80" y="95" textAnchor="middle" fontFamily="'Courier New',monospace" fontSize="8" fill="#333" letterSpacing="3">/ 100</text>
              <text x="80" y="112" textAnchor="middle" fontFamily="'Courier New',monospace" fontSize="10" fontWeight="700"
                fill={gaugeColor} letterSpacing="2" style={{ transition: "fill 0.4s" } as React.CSSProperties}>
                {current.freScore >= 75 ? "CRITICAL" : current.freScore >= 50 ? "ELEVATED" : current.freScore >= 25 ? "WATCH" : "LOW"}
              </text>
            </svg>
          </div>

          {/* Portfolio */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>$10,000 USDC Holding</div>
            <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px" }}>Current value</div>
            <div style={{ fontSize: "32px", fontWeight: "800", fontFamily: "monospace", color: priceColor, lineHeight: 1, transition: "color 0.4s" }}>
              ${parseFloat(portfolioValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: "12px", fontSize: "11px", color: "#555", marginBottom: "4px" }}>Unrealised loss</div>
            <div style={{ fontSize: "22px", fontWeight: "700", fontFamily: "monospace", color: parseFloat(portfolioLoss) > 0 ? "#ef4444" : "#22c55e", transition: "color 0.4s" }}>
              {parseFloat(portfolioLoss) > 0 ? "−" : ""}${parseFloat(portfolioLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: "14px", background: "#111", borderRadius: "6px", height: "6px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${current.price * 100}%`, background: priceColor, borderRadius: "6px", transition: "width 0.8s ease, background 0.4s" }} />
            </div>
            <div style={{ marginTop: "4px", fontSize: "10px", color: "#444", fontFamily: "monospace" }}>{(current.price * 100).toFixed(1)}% of peg</div>
          </div>
        </div>

        {/* Row 2: Alerts + CCIP */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px" }}>

          {/* Alert feed */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "#444", letterSpacing: "0.15em", textTransform: "uppercase" }}>Alert Feed</span>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#333" }}>{alerts.length} fired</span>
            </div>
            <div style={{ minHeight: "120px", maxHeight: "180px", overflowY: "auto" }}>
              {alerts.length === 0 ? (
                <div style={{ padding: "28px 14px", textAlign: "center", fontSize: "11px", color: "#333", fontFamily: "monospace", letterSpacing: "0.1em" }}>[ MONITORING — NO ALERTS ]</div>
              ) : alerts.map((a, i) => {
                const sc = sevColor(a.sev);
                return (
                  <div key={i} style={{ display: "flex", gap: "10px", padding: "9px 14px", borderBottom: "1px solid #111", animation: i === 0 ? "fadeIn 0.3s ease" : undefined }}>
                    <span style={{ flexShrink: 0, fontSize: "9px", fontWeight: "700", fontFamily: "monospace", padding: "2px 6px", borderRadius: "3px", marginTop: "2px", background: sc.bg, color: sc.fg, border: `1px solid ${sc.bd}`, letterSpacing: "0.08em" }}>{a.sev}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", color: "#c0c0c0", lineHeight: "1.4" }}>{a.text}</div>
                      <div style={{ fontSize: "9px", color: "#444", marginTop: "3px", fontFamily: "monospace" }}>{a.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CCIP counter */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "130px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px", textAlign: "center" }}>CCIP<br/>Messages</div>
            <div style={{ fontSize: "56px", fontWeight: "800", fontFamily: "monospace", color: ccip > 0 ? "#3b82f6" : "#1e2a40", lineHeight: 1, transition: "color 0.4s" }}>
              {ccip}
            </div>
            <div style={{ fontSize: "10px", color: "#333", marginTop: "6px", fontFamily: "monospace" }}>cross-chain</div>
          </div>

        </div>

        {/* What happened */}
        <div style={{ background: "#0a0f1a", border: "1px solid #1e2a40", borderRadius: "10px", padding: "16px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "#3b82f6", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px" }}>◉ What Happened — {current.label}</div>
          <p style={{ fontSize: "13px", color: "#9ca3af", lineHeight: "1.65", margin: 0, transition: "opacity 0.3s" }}>
            {current.narrative}
          </p>
        </div>

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </main>
  );
}
