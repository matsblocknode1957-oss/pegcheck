"use client";
import Link from "next/link";
import { useState } from "react";
import { coins } from "../data/coins";

export default function Home() {
  const [hoveredCoin, setHoveredCoin] = useState<string | null>(null);

  const statusColor = (status: string) => {
    if (status === "Healthy") return "#16a34a";
    if (status === "Slight Depeg") return "#d97706";
    if (status === "Warning") return "#ea580c";
    return "#dc2626";
  };

  const statusBg = (status: string) => {
    if (status === "Healthy") return "#f0fdf4";
    if (status === "Slight Depeg") return "#fffbeb";
    if (status === "Warning") return "#fff7ed";
    return "#fef2f2";
  };

  const healthyCount = coins.filter((c) => c.status === "Healthy").length;
  const cautionCount = coins.filter((c) => c.status === "Slight Depeg").length;
  const warningCount = coins.filter((c) => c.status === "Warning").length;

  const now = new Date();
  const timeString = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f8f9fb", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#ffffff", padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>
            P✓
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>PegCheck</div>
            <div style={{ fontSize: "11px", color: "#9ca3af" }}>Simple, real-time stablecoin health monitor</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" }}>Updated {timeString}</div>
          <div style={{ fontSize: "18px" }}>🔔</div>
        </div>
      </div>

      {/* Summary Pills */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 20px", background: "#ffffff", borderBottom: "1px solid #eaecf0", flexWrap: "wrap" }}>
        {healthyCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: "#f0fdf4" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#16a34a" }}>{healthyCount} Healthy</span>
          </div>
        )}
        {cautionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: "#fffbeb" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#d97706" }}>{cautionCount} Caution</span>
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: "#fef2f2" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#dc2626" }}>{warningCount} Warning</span>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "8px 20px", background: "#f8f9fb", borderBottom: "1px solid #eaecf0" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>Coin</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Peg</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Status</span>
      </div>

      {/* Coin Rows */}
      <div style={{ background: "#ffffff" }}>
        {coins.map((coin) => (
          <Link
            key={coin.name}
            href={`/coin/${coin.slug}`}
            onMouseEnter={() => setHoveredCoin(coin.slug)}
            onMouseLeave={() => setHoveredCoin(null)}
            style={{
              textDecoration: "none",
              display: "grid",
              gridTemplateColumns: "1fr 80px 100px",
              alignItems: "center",
              padding: "14px 20px",
              borderBottom: "1px solid #f3f4f6",
              background: hoveredCoin === coin.slug ? "#f9fafb" : "#ffffff",
              transition: "background 0.15s ease",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={coin.icon} alt={coin.name} width={36} height={36} style={{ borderRadius: "50%", display: "block" }} />
                <div style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "11px", height: "11px", borderRadius: "50%", background: statusColor(coin.status), border: "2px solid #ffffff" }}></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{coin.name}</span>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>{coin.issuer}</span>
              </div>
            </div>

            <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "500", color: coin.peg < 0.995 ? statusColor(coin.status) : "#374151", textAlign: "center" }}>
              ${coin.peg.toFixed(3)}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: statusBg(coin.status), color: statusColor(coin.status), whiteSpace: "nowrap" }}>
                {coin.status}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Tap Hint */}
      <div style={{ padding: "12px 20px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", color: "#d1d5db" }}>Tap any coin for full reserve details →</span>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: "#d1d5db", fontFamily: "monospace" }}>PegCheck v0.3 — mock data only · Not financial advice</span>
      </div>

    </main>
  );
}