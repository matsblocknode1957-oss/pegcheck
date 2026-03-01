"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Home() {
  const stablecoins = [
    { name: "USDT", issuer: "Tether", peg: 1.0, icon: "/icons/usdt.png", slug: "usdt", bgColor: "#26a17b" },
    { name: "USDC", issuer: "Circle", peg: 1.0, icon: "/icons/usdc.png", slug: "usdc", bgColor: "#2775ca" },
    { name: "USDS", issuer: "MakerDAO", peg: 0.999, icon: "/icons/usds.png", slug: "usds", bgColor: "#f4b731" },
    { name: "Ethena", issuer: "Ethena Labs", peg: 1.0, icon: "/icons/ethena.png", slug: "ethena", bgColor: "#1a1a2e" },
    { name: "PYUSD", issuer: "PayPal", peg: 1.0, icon: "/icons/pyusd.png", slug: "pyusd", bgColor: "#003087" },
    { name: "FDUSD", issuer: "First Digital", peg: 1.0, icon: "/icons/fdusd.png", slug: "fdusd", bgColor: "#1a1a1a" },
    { name: "RLUSD", issuer: "Ripple", peg: 1.0, icon: "/icons/rlusd.png", slug: "rlusd", bgColor: "#346aa9" },
    { name: "TUSD", issuer: "TrueUSD", peg: 0.997, icon: "/icons/tusd.png", slug: "tusd", bgColor: "#1a3a5c" },
  ];

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<string>("Loading...");
  const [hoveredCoin, setHoveredCoin] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("pegcheck-dark");
    if (saved === "true") setDark(true);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        if (data.prices) {
          setPrices(data.prices);
          const now = new Date();
          setLastUpdated(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        }
      } catch (error) {
        console.error("Failed to fetch prices", error);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const getLivePrice = (slug: string, fallback: number) => prices[slug] ?? fallback;

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
    if (dark) {
      if (status === "Healthy") return "#052e16";
      if (status === "Slight Depeg") return "#451a03";
      if (status === "Warning") return "#431407";
      return "#450a0a";
    }
    if (status === "Healthy") return "#f0fdf4";
    if (status === "Slight Depeg") return "#fffbeb";
    if (status === "Warning") return "#fff7ed";
    return "#fef2f2";
  };

  const healthyCount = stablecoins.filter((c) => getStatus(getLivePrice(c.slug, c.peg)) === "Healthy").length;
  const cautionCount = stablecoins.filter((c) => getStatus(getLivePrice(c.slug, c.peg)) === "Slight Depeg").length;
  const warningCount = stablecoins.filter((c) => ["Warning", "At Risk"].includes(getStatus(getLivePrice(c.slug, c.peg)))).length;

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const rowHover = dark ? "#111f38" : "#f9fafb";
  const tableHeaderBg = dark ? "#080e1a" : "#f8f9fb";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";
  const dotBorder = dark ? "#0d1628" : "#ffffff";
return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: textPrimary }}>PegCheck</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>Real-time stablecoin health monitor</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>
          <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", padding: "12px 20px", background: headerBg, borderBottom: `1px solid ${headerBorder}`, flexWrap: "wrap" }}>
        {healthyCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#052e16" : "#f0fdf4" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#16a34a" }}>{healthyCount} Healthy</span>
          </div>
        )}
        {cautionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#451a03" : "#fffbeb" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#d97706" }}>{cautionCount} Caution</span>
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#450a0a" : "#fef2f2" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#dc2626" }}>{warningCount} Warning</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "8px 20px", background: tableHeaderBg, borderBottom: `1px solid ${headerBorder}` }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Coin</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Peg</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Status</span>
      </div>

      <div style={{ background: cardBg, transition: "background 0.2s ease" }}>
        {stablecoins.map((coin) => {
          const livePrice = getLivePrice(coin.slug, coin.peg);
          const liveStatus = getStatus(livePrice);
          return (
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
                borderBottom: `1px solid ${cardBorder}`,
                background: hoveredCoin === coin.slug ? rowHover : cardBg,
                transition: "background 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={coin.icon} alt={coin.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                  </div>
                  <div style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "11px", height: "11px", borderRadius: "50%", background: statusColor(liveStatus), border: `2px solid ${dotBorder}` }}></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: textPrimary }}>{coin.name}</span>
                  <span style={{ fontSize: "11px", color: textSecondary }}>{coin.issuer}</span>
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "500", color: livePrice < 0.995 ? statusColor(liveStatus) : (dark ? "#d1d5db" : "#374151"), textAlign: "center" }}>
                ${livePrice.toFixed(4)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: statusBg(liveStatus), color: statusColor(liveStatus), whiteSpace: "nowrap" }}>
                  {liveStatus}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", color: textSecondary }}>Tap any coin for full reserve details →</span>
      </div>

      <div style={{ padding: "12px 20px 4px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: dark ? "#374151" : "#d1d5db", fontFamily: "monospace" }}>PegCheck v1.0 — live data · Not financial advice</span>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/" ? "#1a56db" : textSecondary }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/alerts" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/alerts" ? "#1a56db" : textSecondary }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/about" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/about" ? "#1a56db" : textSecondary }}>About</span>
        </a>
      </div>

    </main>
);
}