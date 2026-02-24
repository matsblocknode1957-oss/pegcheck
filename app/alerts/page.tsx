"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AlertsPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const pathname = usePathname();

  const coins = [
    { name: "USDT", issuer: "Tether", slug: "usdt", icon: "/icons/usdt.png", bgColor: "#26a17b" },
    { name: "USDC", issuer: "Circle", slug: "usdc", icon: "/icons/usdc.png", bgColor: "#2775ca" },
    { name: "USDS", issuer: "MakerDAO", slug: "usds", icon: "/icons/usds.png", bgColor: "#f4b731" },
    { name: "Ethena", issuer: "Ethena Labs", slug: "ethena", icon: "/icons/ethena.png", bgColor: "#1a1a2e" },
    { name: "PYUSD", issuer: "PayPal", slug: "pyusd", icon: "/icons/pyusd.png", bgColor: "#003087" },
    { name: "FDUSD", issuer: "First Digital", slug: "fdusd", icon: "/icons/fdusd.png", bgColor: "#1a1a1a" },
    { name: "RLUSD", issuer: "Ripple", slug: "rlusd", icon: "/icons/rlusd.png", bgColor: "#346aa9" },
    { name: "TUSD", issuer: "TrueUSD", slug: "tusd", icon: "/icons/tusd.png", bgColor: "#1a3a5c" },
  ];

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => { if (d.prices) setPrices(d.prices); })
      .catch(() => {});
  }, []);

  const getStatus = (price: number) => {
    if (price >= 0.999) return "Healthy";
    if (price >= 0.995) return "Slight Depeg";
    if (price >= 0.990) return "Warning";
    return "At Risk";
  };

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

  const depegged = coins.filter((c) => {
    const price = prices[c.slug] ?? 1.0;
    return getStatus(price) !== "Healthy";
  });

  const handleSubmit = () => {
    if (email.includes("@")) {
      setSubmitted(true);
    }
  };

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f8f9fb", minHeight: "100vh", paddingBottom: "70px" }}>

      <div style={{ background: "#ffffff", padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
        <span style={{ fontSize: "16px", fontWeight: "700", color: "#111827" }}>Alerts</span>
      </div>

      <div style={{ margin: "16px 20px 0", borderRadius: "12px", overflow: "hidden", border: "1px solid #eaecf0" }}>
        <div style={{ background: "#1a56db", padding: "12px 16px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.5px" }}>🔴 Live Alerts</span>
        </div>
        {depegged.length === 0 ? (
          <div style={{ background: "#ffffff", padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>✅</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#16a34a" }}>All stablecoins healthy</div>
            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>No depeg events detected right now</div>
          </div>
        ) : (
          depegged.map((coin) => {
            const price = prices[coin.slug] ?? 1.0;
            const status = getStatus(price);
            return (
              <div key={coin.slug} style={{ background: "#ffffff", padding: "14px 16px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={coin.icon} alt={coin.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{coin.name}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{coin.issuer}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "600", color: statusColor(status) }}>${price.toFixed(4)}</div>
                  <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: statusBg(status), color: statusColor(status) }}>{status}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "6px" }}>🔔 Get Depeg Alerts</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px", lineHeight: "1.5" }}>Be the first to know when a stablecoin loses its peg. Free email alerts, no spam, cancel anytime.</div>
        {submitted ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>🎉</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#16a34a" }}>You're on the list!</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>We'll alert you the moment anything changes.</div>
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px", marginBottom: "10px", boxSizing: "border-box", outline: "none" }}
            />
            <button
              onClick={handleSubmit}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", color: "white", fontSize: "14px", fontWeight: "700", border: "none", cursor: "pointer" }}
            >
              Notify Me Free →
            </button>
          </div>
        )}
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Coming Soon — Premium</div>
        {["Instant SMS alerts", "Custom depeg thresholds", "Portfolio value at risk calculator", "Weekly stablecoin health report"].map((feature) => (
          <div key={feature} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "10px" }}>⚡</span>
            </div>
            <span style={{ fontSize: "13px", color: "#374151" }}>{feature}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: "#d1d5db", fontFamily: "monospace" }}>PegCheck v0.6 — Not financial advice</span>
      </div>

      {/* Bottom Navigation */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #eaecf0", display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>🏠</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>🔔</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>ℹ️</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>About</span>
        </a>
      </div>

    </main>
  );
}