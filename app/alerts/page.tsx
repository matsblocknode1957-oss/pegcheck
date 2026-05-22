"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

export default function AlertsPage() {
  const [email, setEmail] = useState("");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [eurUsd, setEurUsd] = useState(1.13);
  const [upgrading, setUpgrading] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pegcheck-dark") === "true";
    }
    return false;
  });

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const upgraded = searchParams?.get("upgraded") === "true";

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => { if (d.prices) setPrices(d.prices); if (d.eurUsd) setEurUsd(d.eurUsd); })
      .catch(() => {});
  }, []);

  const coins = [
    { name: "USDT", issuer: "Tether", slug: "usdt", icon: "/icons/usdt.png", bgColor: "#26a17b" },
    { name: "USDC", issuer: "Circle", slug: "usdc", icon: "/icons/usdc.png", bgColor: "#2775ca" },
    { name: "USDS", issuer: "MakerDAO", slug: "usds", icon: "/icons/usds.png", bgColor: "#f4b731" },
    { name: "Ethena", issuer: "Ethena Labs", slug: "ethena", icon: "/icons/ethena.png", bgColor: "#1a1a2e" },
    { name: "PYUSD", issuer: "PayPal", slug: "pyusd", icon: "/icons/pyusd.png", bgColor: "#003087" },
    { name: "FDUSD", issuer: "First Digital", slug: "fdusd", icon: "/icons/fdusd.png", bgColor: "#1a1a1a" },
    { name: "RLUSD", issuer: "Ripple", slug: "rlusd", icon: "/icons/rlusd.png", bgColor: "#346aa9" },
    { name: "TUSD",   issuer: "TrueUSD",        slug: "tusd",   icon: "/icons/tusd.png",   bgColor: "#1a3a5c" },
    { name: "FRAX",   issuer: "Frax Finance",    slug: "frax",   icon: "/icons/frax.png",   bgColor: "#1c1c1c" },
    { name: "GHO",    issuer: "Aave",            slug: "gho",    icon: "/icons/gho.png",    bgColor: "#b6509e" },
    { name: "crvUSD", issuer: "Curve Finance",   slug: "crvusd", icon: "/icons/crvusd.png", bgColor: "#3a3a3a" },
    { name: "LUSD",   issuer: "Liquity",         slug: "lusd",   icon: "/icons/lusd.png",   bgColor: "#2eb6ae" },
    { name: "USDP",   issuer: "Paxos",           slug: "usdp",   icon: "/icons/usdp.png",   bgColor: "#00735b" },
    { name: "USDD",   issuer: "TRON DAO",        slug: "usdd",   icon: "/icons/usdd.png",   bgColor: "#eb0029" },
    { name: "mkUSD",  issuer: "Prisma Finance",  slug: "mkusd",  icon: "/icons/mkusd.png",  bgColor: "#6b21a8" },
    { name: "EURC",   issuer: "Circle",          slug: "eurc",   icon: "/icons/eurc.png",   bgColor: "#2563eb" },
    { name: "DOLA",   issuer: "Inverse Finance", slug: "dola",   icon: "/icons/dola.png",   bgColor: "#1e3a5f" },
    { name: "alUSD",  issuer: "Alchemix",        slug: "alusd",  icon: "/icons/alusd.png",  bgColor: "#f59e0b" },
    { name: "BOLD",   issuer: "Liquity V2",      slug: "bold",   icon: "/icons/bold.svg",   bgColor: "#0f766e" },
  ];

  const getEffectivePeg = (slug: string) => slug === "eurc" ? eurUsd : (COIN_PEGS[slug] ?? 1.0);

  const getStatus = (price: number, peg: number, slug = '') => {
    const { healthy, caution } = getThresholds(slug);
    const diff = Math.abs(price - peg) / peg;
    if (diff <= healthy) return "Healthy";
    if (diff <= caution) return "Caution";
    return "Depeg";
  };

  const statusColor = (status: string) => {
    if (status === "Healthy") return "#16a34a";
    if (status === "Caution") return "#d97706";
    return "#dc2626";
  };

  const statusBg = (status: string) => {
    if (dark) {
      if (status === "Healthy") return "#052e16";
      if (status === "Caution") return "#451a03";
      return "#450a0a";
    }
    if (status === "Healthy") return "#f0fdf4";
    if (status === "Caution") return "#fffbeb";
    return "#fef2f2";
  };

  const depegged = coins.filter((c) => {
    const price = prices[c.slug] ?? getEffectivePeg(c.slug);
    return getStatus(price, getEffectivePeg(c.slug), c.slug) !== "Healthy";
  });

  const handleUpgrade = async () => {
    if (!email.includes("@")) {
      alert("Please enter your email first");
      return;
    }
    setUpgrading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setUpgrading(false);
    }
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

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>Alerts</span>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {upgraded && (
        <div style={{ margin: "16px 20px 0", background: dark ? "#052e16" : "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#16a34a" }}>🎉 Welcome to Premium!</div>
          <div style={{ fontSize: "13px", color: textSecondary, marginTop: "4px" }}>You'll receive instant alerts when any stablecoin drops below $0.975</div>
        </div>
      )}

      <div style={{ margin: "16px 20px 0", borderRadius: "12px", overflow: "hidden", border: `1px solid ${headerBorder}` }}>
        <div style={{ background: "#1a56db", padding: "12px 16px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.5px" }}>🔴 Live Alerts</span>
        </div>
        {depegged.length === 0 ? (
          <div style={{ background: cardBg, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>✅</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#16a34a" }}>All stablecoins healthy</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>No depeg events detected right now</div>
          </div>
        ) : (
          depegged.map((coin) => {
            const price = prices[coin.slug] ?? getEffectivePeg(coin.slug);
            const status = getStatus(price, getEffectivePeg(coin.slug), coin.slug);
            return (
              <div key={coin.slug} style={{ background: cardBg, padding: "14px 16px", borderTop: `1px solid ${cardBorder}`, display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={coin.icon} alt={coin.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: textPrimary }}>{coin.name}</div>
                  <div style={{ fontSize: "11px", color: textSecondary }}>{coin.issuer}</div>
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

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "6px" }}>Get Instant Depeg Alerts</div>
        <div style={{ fontSize: "13px", color: textSecondary, marginBottom: "16px", lineHeight: "1.5" }}>Enter your email and upgrade to Premium — be first to know when a stablecoin depegs.</div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${inputBorder}`, fontSize: "14px", marginBottom: "10px", boxSizing: "border-box", outline: "none", background: inputBg, color: textPrimary }}
        />
        <button
          onClick={handleUpgrade}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#16a34a", color: "#ffffff", fontSize: "14px", fontWeight: "700", border: "none", cursor: "pointer" }}
        >
          {upgrading ? "Redirecting to checkout..." : "Upgrade to Premium — £4.99/month ⚡"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Premium Features ⚡</div>
        {["Instant alerts when any coin drops below $0.975", "Email notification within seconds of detection", "Be first to know before the market reacts", "Cancel anytime"].map((feature) => (
          <div key={feature} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: dark ? "#1e3a5f" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span style={{ fontSize: "13px", color: dark ? "#d1d5db" : "#374151" }}>{feature}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>About</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>History</span>
        </a>
      </div>

    </main>
  );
}