"use client";
import { useState } from "react";

type Position = {
  protocol: string;
  healthFactor: number;
  collateralUSD: number;
  debtUSD: number;
  liquidationPrice: number;
  collateralAsset: string;
};

export default function PositionsPage() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [searched, setSearched] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("liquidlens-dark") === "true";
    }
    return false;
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("liquidlens-dark", String(next));
  };

  const fetchPositions = async () => {
    if (!wallet.startsWith("0x") || wallet.length !== 42) {
      alert("Please enter a valid Ethereum wallet address");
      return;
    }
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/positions?wallet=${wallet}`);
      const data = await res.json();
      setPositions(data.positions || []);
      setSearched(true);
    } catch (e) {
      setPositions([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (hf: number) => {
    if (hf >= 2.0) return { label: "Safe", color: "#10b981", bg: dark ? "#052e16" : "#f0fdf4" };
    if (hf >= 1.5) return { label: "Moderate", color: "#f59e0b", bg: dark ? "#451a03" : "#fffbeb" };
    if (hf >= 1.2) return { label: "At Risk", color: "#f97316", bg: dark ? "#431407" : "#fff7ed" };
    return { label: "Critical", color: "#ef4444", bg: dark ? "#450a0a" : "#fef2f2" };
  };

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#eaecf0";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const inputBg = dark ? "#111f38" : "#ffffff";
  const inputBorder = dark ? "#1e2a40" : "#e5e7eb";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>L🔍</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: textPrimary }}>LiquidLens</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>DeFi Position Monitor</div>
          </div>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "6px" }}>Check Your Positions</div>
        <div style={{ fontSize: "13px", color: textSecondary, marginBottom: "14px" }}>Enter any Ethereum wallet to see live DeFi health factors across Aave and Compound.</div>
        <input
          type="text"
          placeholder="0x... wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPositions()}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${inputBorder}`, fontSize: "13px", marginBottom: "10px", boxSizing: "border-box", outline: "none", background: inputBg, color: textPrimary, fontFamily: "monospace" }}
        />
        <button
          onClick={fetchPositions}
          disabled={loading}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontSize: "14px", fontWeight: "700", border: "none", cursor: "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Scanning protocols..." : "Check Positions 🔍"}
        </button>
      </div>

      {searched && positions.length === 0 && (
        <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "24px 20px", border: `1px solid ${cardBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: textPrimary }}>No active positions found</div>
          <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>This wallet has no open positions on Aave or Compound</div>
        </div>
      )}

      {positions.map((pos, i) => {
        const health = getHealthStatus(pos.healthFactor);
        return (
          <div key={i} style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary }}>{pos.protocol}</div>
              <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", background: health.bg, color: health.color }}>{health.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: dark ? "#080e1a" : "#f8f9fb", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "4px" }}>Health Factor</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: health.color }}>{pos.healthFactor.toFixed(2)}</div>
              </div>
              <div style={{ background: dark ? "#080e1a" : "#f8f9fb", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "4px" }}>Liquidation Price</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: textPrimary }}>${pos.liquidationPrice.toLocaleString()}</div>
              </div>
              <div style={{ background: dark ? "#080e1a" : "#f8f9fb", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "4px" }}>Collateral</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>${pos.collateralUSD.toLocaleString()}</div>
                <div style={{ fontSize: "11px", color: textSecondary }}>{pos.collateralAsset}</div>
              </div>
              <div style={{ background: dark ? "#080e1a" : "#f8f9fb", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "4px" }}>Debt</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>${pos.debtUSD.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ height: "6px", background: dark ? "#1e2a40" : "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min((pos.healthFactor / 3) * 100, 100)}%`, background: `linear-gradient(90deg, ${health.color}, ${health.color}aa)`, borderRadius: "3px", transition: "width 0.5s ease" }}></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
              <span style={{ fontSize: "10px", color: "#ef4444" }}>Liquidation 1.0</span>
              <span style={{ fontSize: "10px", color: "#10b981" }}>Safe 2.0+</span>
            </div>
          </div>
        );
      })}

      <div style={{ margin: "16px 20px 0", background: dark ? "#0d1628" : "#eff6ff", borderRadius: "12px", padding: "16px 20px", border: `1px solid ${dark ? "#1e3a5f" : "#bfdbfe"}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "#3b82f6", marginBottom: "4px" }}>⚡ Get Liquidation Alerts</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginBottom: "10px" }}>Set a health factor threshold and get email alerts before you get liquidated.</div>
        <a href="/alerts" style={{ display: "inline-block", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontSize: "12px", fontWeight: "700", textDecoration: "none" }}>Set Up Alerts →</a>
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Market</span>
        </a>
        <a href="/positions" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#3b82f6" }}>Positions</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Alerts</span>
        </a>
      </div>

    </main>
  );
}
