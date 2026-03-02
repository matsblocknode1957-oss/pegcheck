"use client";
import { usePathname } from "next/navigation";

export default function AboutPage() {
  const pathname = usePathname();

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f8f9fb", minHeight: "100vh", paddingBottom: "70px" }}>

      <div style={{ background: "#ffffff", padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
        <span style={{ fontSize: "16px", fontWeight: "700", color: "#111827" }}>About</span>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>What is PegCheck?</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck is a real-time stablecoin health monitoring platform. It tracks the peg price of the most widely used stablecoins — USDT, USDC, USDS, PYUSD, FDUSD, RLUSD, TUSD and Ethena — and flags any deviation the moment it happens. Premium subscribers receive instant email alerts when any coin drops below $0.975.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>Why we built it</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>In 2022 TerraUSD collapsed almost overnight, wiping out billions in savings. Most people had no idea it was happening until it was too late. PegCheck exists so that never happens to you without warning. Be first to know. Before the market reacts.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>Who is it for?</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>Anyone holding or using stablecoins. You don't need to be a trader or a crypto expert. If you have money in USDT, USDC or any other stablecoin, you deserve to know the second something goes wrong.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>How it works</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck pulls live price data every 60 seconds and automatically flags any coin that strays from its $1.00 peg. Green means healthy. Amber means watch closely. Red means act now. Premium subscribers get an instant email alert the moment any coin crosses the danger threshold.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>Roadmap</div>
        {[
          { label: "Multi-source price feeds", desc: "Coinbase, Binance and Kraken alongside CoinGecko for median pricing. No single point of failure." },
          { label: "Historical data & charts", desc: "7, 30 and 90 day price charts for every stablecoin we track." },
          { label: "Collateralisation ratios", desc: "See exactly what backs each stablecoin and how safe the reserves are." },
          { label: "Reserve transparency", desc: "Audit dates, reserve breakdowns and transparency scores for every coin." },
          { label: "Mint & burn activity", desc: "Unusual minting or burning is often an early warning sign. We'll flag it." },
          { label: "Wallet integration", desc: "Connect your wallet and monitor only the stablecoins you actually hold." },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", gap: "12px", marginBottom: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{item.label}</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", lineHeight: "1.5" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>The small print</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck displays information only. Nothing on this site is financial advice. Always do your own research before making any financial decisions.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "16px 20px", border: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>Built by FintechCheck</span>
        <a href="https://pegcheck.uk" style={{ fontSize: "13px", color: "#1a56db", fontWeight: "600", textDecoration: "none" }}>pegcheck.uk</a>
      </div>

      <div style={{ padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: "#d1d5db", fontFamily: "monospace" }}>PegCheck v1.0 — Not financial advice</span>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #eaecf0", display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>About</span>
        </a>
      </div>
<div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Roadmap</div>
        {[
          { label: "Multi-source price feeds", desc: "Coinbase, Binance and Kraken alongside CoinGecko for median pricing. No single point of failure." },
          { label: "Historical data & charts", desc: "7, 30 and 90 day price charts for every stablecoin we track." },
          { label: "Collateralisation ratios", desc: "See exactly what backs each stablecoin and how safe the reserves are." },
          { label: "Reserve transparency", desc: "Audit dates, reserve breakdowns and transparency scores for every coin." },
          { label: "Mint & burn activity", desc: "Unusual minting or burning is often an early warning sign. We'll flag it." },
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

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>The small print</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck displays information only. Nothing on this site is financial advice. Always do your own research before making any financial decisions.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "16px 20px", border: `1px solid ${cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "13px", color: textSecondary }}>Built by FintechCheck</span>
        <a href="https://pegcheck.uk" style={{ fontSize: "13px", color: "#1a56db", fontWeight: "600", textDecoration: "none" }}>pegcheck.uk</a>
      </div>

      <div style={{ padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: dark ? "#374151" : "#d1d5db", fontFamily: "monospace" }}>PegCheck v1.0 — Not financial advice</span>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>About</span>
        </a>
      </div>

    </main>
  );
}