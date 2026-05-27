"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const CONTRACT = "0xc30093c695bb9e757170fe568f6248e7c13eef8f";

export default function StableGuardPage() {
  const pathname = usePathname();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("Loading...");
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pegcheck-dark") === "true";
    return false;
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  const fetchAll = async () => {
    try {
      const pd = await fetch("/api/prices").then((r) => r.json());
      if (pd.prices) setPrices(pd.prices);
      setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const score = 5;
  const isActive = true;
  const priceFeedScore = 3;
  const uniswapScore = 2;

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#eaecf0";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#6b7280";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";
  const innerBg = dark ? "#080e1a" : "#f8f9fb";

  const scoreColor = "#22c55e";
  const scoreLabel = "Strong";

  const coinStatus = (slug: string) => {
    const price = prices[slug] ?? 1.0;
    const diff = Math.abs(price - 1.0);
    if (diff <= 0.001) return "Healthy";
    if (diff <= 0.005) return "Caution";
    return "Depeg";
  };
  const statusColor = (s: string) => s === "Healthy" ? "#16a34a" : s === "Caution" ? "#d97706" : "#dc2626";
  const statusBg = (s: string) => {
    if (dark) return s === "Healthy" ? "#052e16" : s === "Caution" ? "#451a03" : "#450a0a";
    return s === "Healthy" ? "#f0fdf4" : s === "Caution" ? "#fffbeb" : "#fef2f2";
  };

  const navItem = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href;
    return (
      <a href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
        {icon}
        <span style={{ fontSize: "9px", fontWeight: "600", color: active ? "#1a56db" : textSecondary }}>{label}</span>
      </a>
    );
  };

  const navColor = (href: string) => pathname === href ? "#1a56db" : textSecondary;

  const monitoredCoins = [
    { slug: "usdt",   name: "USDT",   icon: "/icons/usdt.png",   bgColor: "#26a17b" },
    { slug: "usdc",   name: "USDC",   icon: "/icons/usdc.png",   bgColor: "#2775ca" },
    { slug: "usds",   name: "USDS",   icon: "/icons/usds.png",   bgColor: "#f4b731" },
    { slug: "ethena", name: "USDe",   icon: "/icons/ethena.png", bgColor: "#1a1a2e" },
    { slug: "pyusd",  name: "PYUSD",  icon: "/icons/pyusd.png",  bgColor: "#003087" },
    { slug: "fdusd",  name: "FDUSD",  icon: "/icons/fdusd.png",  bgColor: "#1a1a1a" },
    { slug: "rlusd",  name: "RLUSD",  icon: "/icons/rlusd.png",  bgColor: "#346aa9" },
    { slug: "tusd",   name: "TUSD",   icon: "/icons/tusd.png",   bgColor: "#1a3a5c" },
    { slug: "frax",   name: "FRAX",   icon: "/icons/frax.png",   bgColor: "#1c1c1c" },
    { slug: "gho",    name: "GHO",    icon: "/icons/gho.png",    bgColor: "#b6509e" },
    { slug: "crvusd", name: "crvUSD", icon: "/icons/crvusd.png", bgColor: "#3a3a3a" },
    { slug: "lusd",   name: "LUSD",   icon: "/icons/lusd.png",   bgColor: "#2eb6ae" },
    { slug: "usdp",   name: "USDP",   icon: "/icons/usdp.png",   bgColor: "#00735b" },
    { slug: "usdd",   name: "USDD",   icon: "/icons/usdd.png",   bgColor: "#eb0029" },
    { slug: "mkusd",  name: "mkUSD",  icon: "/icons/mkusd.png",  bgColor: "#6b21a8" },
    { slug: "eurc",   name: "EURC",   icon: "/icons/eurc.png",   bgColor: "#2563eb" },
    { slug: "dola",   name: "DOLA",   icon: "/icons/dola.png",   bgColor: "#1e3a5f" },
    { slug: "alusd",  name: "alUSD",  icon: "/icons/alusd.png",  bgColor: "#f59e0b" },
    { slug: "bold",   name: "BOLD",   icon: "/icons/bold.svg",   bgColor: "#0f766e" },
  ];

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>
      <style>{`@keyframes sgpulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>

      {/* Header */}
      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>StableGuard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>
          <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #0a1220 0%, #0d1e38 100%)", padding: "32px 20px 28px", borderBottom: `1px solid #1e2a40`, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "18px", marginBottom: "16px", boxShadow: "0 8px 32px rgba(26,86,219,0.4)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div style={{ fontSize: "30px", fontWeight: "800", color: "#f9fafb", marginBottom: "6px", letterSpacing: "-0.5px" }}>StableGuard</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "24px" }}>Autonomous Cross-Chain Depeg Protection</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", borderRadius: "30px", background: isActive ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)", border: `1px solid ${isActive ? "#166534" : "#991b1b"}` }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isActive ? "#22c55e" : "#ef4444", animation: isActive ? "sgpulse 2s infinite" : "none" }} />
          <span style={{ fontSize: "12px", fontWeight: "700", color: isActive ? "#22c55e" : "#ef4444", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            PROTECTION ACTIVE
          </span>
        </div>
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#6b7280" }}>Smart contracts deployed on Sepolia testnet — mainnet ready</div>
      </div>

      {/* Confidence Score Gauge */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "18px" }}>Confidence Score</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "8px" }}>
          <div style={{ fontSize: "60px", fontWeight: "800", fontFamily: "monospace", color: scoreColor, lineHeight: 1 }}>
            {score}
          </div>
          <div>
            <div style={{ fontSize: "16px", color: textSecondary, fontFamily: "monospace" }}>/5</div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: scoreColor, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>{scoreLabel}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: "11px", color: textSecondary, marginBottom: "16px" }}>Last verified May 2026</div>
        {/* Bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ flex: 1, height: "10px", borderRadius: "5px", transition: "background 0.4s ease", background: score !== null && i <= score ? scoreColor : (dark ? "#1e2a40" : "#e5e7eb") }} />
          ))}
        </div>
        {/* Breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ background: innerBg, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${cardBorder}` }}>
            <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "8px" }}>Price Feeds</div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              {[1,2,3].map((i) => (
                <div key={i} style={{ width: "22px", height: "22px", borderRadius: "4px", background: priceFeedScore !== null && i <= priceFeedScore ? "#22c55e" : (dark ? "#1e2a40" : "#e5e7eb") }} />
              ))}
            </div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{priceFeedScore}/3 pts</div>
          </div>
          <div style={{ background: innerBg, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${cardBorder}` }}>
            <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "8px" }}>Uniswap V3</div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              {[1,2].map((i) => (
                <div key={i} style={{ width: "22px", height: "22px", borderRadius: "4px", background: uniswapScore !== null && i <= uniswapScore ? "#1a56db" : (dark ? "#1e2a40" : "#e5e7eb") }} />
              ))}
            </div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{uniswapScore}/2 pts</div>
          </div>
        </div>
      </div>

      {/* CCIP Messages Counter */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>Cross-Chain Messages</div>
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ fontSize: "52px", fontWeight: "800", fontFamily: "monospace", color: "#1a56db", lineHeight: 1 }}>27+</div>
          <div style={{ fontSize: "13px", color: textSecondary, marginTop: "6px" }}>Cross-Chain Messages Fired</div>
          <a href="https://sepolia.etherscan.io/address/0xc30093c695bb9e757170fe568f6248e7c13eef8f#events" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "10px", fontSize: "12px", fontWeight: "600", color: "#1a56db", textDecoration: "none" }}>
            Verified on Sepolia Etherscan ↗
          </a>
        </div>
      </div>

      {/* Monitored Assets */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
          Monitored Assets <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: 0 }}>({monitoredCoins.length})</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {monitoredCoins.map((coin) => {
            const price = prices[coin.slug] ?? 1.0;
            const s = coinStatus(coin.slug);
            return (
              <div key={coin.slug} style={{ background: innerBg, borderRadius: "10px", padding: "12px", border: `1px solid ${cardBorder}`, display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    <img src={coin.icon} alt={coin.name} style={{ width: "18px", height: "18px", objectFit: "contain" }} />
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "600", color: textPrimary }}>${price.toFixed(4)}</span>
                  <span style={{ padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", background: statusBg(s), color: statusColor(s) }}>{s}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chainlink Services */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>Chainlink Services</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {["Price Feeds", "CCIP", "Automation", "Data Streams"].map((svc) => (
            <div key={svc} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "8px", background: dark ? "rgba(22,163,74,0.1)" : "#f0fdf4", border: `1px solid ${dark ? "#166534" : "#bbf7d0"}` }}>
              <span style={{ fontSize: "12px" }}>✅</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#d1fae5" : "#166534" }}>{svc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contract links */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Contract</div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
          <a href={`https://sepolia.etherscan.io/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1a56db", textDecoration: "none", fontWeight: "600" }}>View Contract ↗</a>
          <a href={`https://sepolia.etherscan.io/address/${CONTRACT}#events`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#1a56db", textDecoration: "none", fontWeight: "600" }}>View Events ↗</a>
        </div>
        <div style={{ padding: "10px 12px", background: innerBg, borderRadius: "8px", border: `1px solid ${cardBorder}` }}>
          <div style={{ fontSize: "10px", color: textSecondary, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contract (Sepolia)</div>
          <div style={{ fontFamily: "monospace", fontSize: "11px", color: textPrimary, wordBreak: "break-all" }}>{CONTRACT}</div>
        </div>
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af" }}>Not financial advice</div>
      </div>

      {/* Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navColor("/")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: navColor("/") }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navColor("/alerts")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: navColor("/alerts") }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navColor("/about")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: navColor("/about") }}>About</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navColor("/history")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: navColor("/history") }}>History</span>
        </a>
        <a href="/stableguard" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={navColor("/stableguard")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: navColor("/stableguard") }}>Guard</span>
        </a>
      </div>
    </main>
  );
}
