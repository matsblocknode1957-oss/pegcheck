"use client";
import { useState } from "react";

export default function AboutPage() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pegcheck-dark") === "true";
    }
    return false;
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#eaecf0";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#6b7280";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>About</span>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>What is PegCheck?</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck is a real-time stablecoin health monitoring platform. It tracks 19 stablecoins — including USD-pegged coins like USDT, USDC, USDS, PYUSD, LUSD, FRAX and BOLD, as well as EUR-pegged coins like EURC — and flags any peg deviation the moment it happens. Each coin is tracked against its own individual peg target and threshold. DEX divergence is also monitored via Uniswap V3, showing when on-chain pool prices diverge from the off-chain consensus. Premium subscribers receive instant email alerts when any coin depegs.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>Why we built it</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>In 2022 TerraUSD collapsed almost overnight, wiping out billions in savings. Most people had no idea it was happening until it was too late. PegCheck exists so that never happens to you without warning. Be first to know. Before the market reacts.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>Who is it for?</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Anyone holding or using stablecoins. You don't need to be a trader or a crypto expert. If you have money in USDT, USDC or any other stablecoin, you deserve to know the second something goes wrong.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>How it works</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck pulls live price data every 60 seconds from 7 independent sources — CoinGecko, Coinbase, Binance, Kraken, DefiLlama, Chainlink and Uniswap V3 — and calculates a median consensus price to eliminate bad data. A dual-source confidence score flags when fewer than two sources agree. Each coin is evaluated against its own peg target and per-coin thresholds: most coins use ±0.1% healthy / ±0.5% caution, while coins designed to trade slightly above peg (like LUSD and mkUSD) use wider bands. Green means healthy. Amber means caution. Red means depeg detected.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Roadmap</div>
        {[
          { label: "✅ Multi-source price feeds", desc: "Live — prices aggregated from CoinGecko, Coinbase, Binance, Kraken, DefiLlama and Chainlink. Median calculation protects against bad data." },
          { label: "✅ Historical data & charts", desc: "Live — 7, 30 and 90 day price charts for every stablecoin we track." },
          { label: "✅ Collateralisation ratios", desc: "Live — reserve breakdowns and collateral ratios for every coin." },
          { label: "✅ Reserve transparency", desc: "Live — audit dates, auditors and transparency scores for every coin." },
          { label: "✅ Large transaction tracking", desc: "Live — significant on-chain movements flagged automatically." },
          { label: "✅ REST API with authentication", desc: "Live — real-time stablecoin data API with Bearer token auth, 3 pricing tiers and 30 day free trial." },
          { label: "✅ Developer dashboard", desc: "Live — API customers can view their key, usage stats and calls remaining at pegcheck.uk/dashboard." },
          { label: "✅ Chainlink Proof of Reserve", desc: "Live — on-chain verified reserve data for supported stablecoins, powered by Chainlink." },
          { label: "✅ On-chain depeg event logging", desc: <>Live — every depeg event is permanently recorded on the Sepolia blockchain and publicly verifiable at <a href="/onchain" style={{ color: "#1a56db", textDecoration: "none" }}>pegcheck.uk/onchain</a>.</> },
          { label: "✅ Depeg History Page", desc: "Live — full historical depeg events, stability rankings, all-time lows and most stable coins across all 19 tracked stablecoins." },
          { label: "✅ DEX Divergence Monitoring", desc: "Live — Uniswap V3 pool prices cross-checked against consensus for USDC and USDT, divergence shown in basis points on each coin detail page." },
          { label: "✅ 19 Stablecoin Coverage", desc: "Live — expanded from 8 to 19 coins including FRAX, GHO, crvUSD, LUSD, USDP, USDD, mkUSD, EURC, DOLA, alUSD and BOLD." },
          { label: "✅ Individual Peg Targets", desc: "Live — each coin tracked against its own peg (USD or EUR), with per-coin healthy/caution/depeg thresholds tuned to each coin's design." },
          { label: "Wallet integration", desc: "Connect your wallet and monitor only the stablecoins you actually hold." },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", gap: "12px", marginBottom: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: dark ? "#1e2a40" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{item.label}</div>
              <div style={{ fontSize: "12px", color: textSecondary, marginTop: "2px", lineHeight: "1.5" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* For Developers */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>🛠️ For Developers</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: "0 0 12px 0" }}>
          Building a wallet, exchange, or DeFi app? PegCheck offers a REST API with real-time data for all 19 stablecoins — prices, deviation, status, depeg history and Uniswap V3 DEX divergence (via the <code style={{ fontSize: "12px", background: dark ? "#1e2a40" : "#f3f4f6", padding: "1px 5px", borderRadius: "4px", color: textPrimary }}>uniswap</code> field in the response). Powered by 7 independent sources with median consensus.
        </p>
        <a href="/developers" style={{ display: "inline-block", background: "#1a56db", color: "#fff", fontSize: "13px", fontWeight: "700", padding: "10px 20px", borderRadius: "8px", textDecoration: "none" }}>
          View API & Pricing →
        </a>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>The small print</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck displays information only. Nothing on this site is financial advice. Always do your own research before making any financial decisions.</p>
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
          <span style={{ fontSize: "9px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: "#1a56db" }}>About</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>History</span>
        </a>
        <a href="/stableguard" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Guard</span>
        </a>
      </div>

    </main>
  );
}