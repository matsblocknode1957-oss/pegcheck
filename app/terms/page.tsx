
"use client";
import { useState } from "react";

export default function TermsPage() {
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
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>Terms of Service</span>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>Terms of Service</div>
        <p style={{ fontSize: "12px", color: textSecondary, margin: "0 0 16px 0" }}>Last updated: March 2026</p>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>These Terms of Service govern your use of PegCheck, a product of FintechCheck. By accessing or using PegCheck you agree to these terms.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>1. Not Financial Advice</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck displays publicly available market data for informational purposes only. Nothing on this platform constitutes financial advice, investment advice, trading advice or any other type of advice. You should not make any financial decision based solely on information provided by PegCheck. Always conduct your own research and consult a qualified financial adviser before making any financial decisions.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>2. Data Accuracy</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck aggregates price data from multiple third party sources including CoinGecko, Coinbase, Binance, Kraken and DefiLlama. Whilst we use a median calculation to improve accuracy, we cannot guarantee that data is always accurate, complete or up to date. FintechCheck accepts no liability for decisions made based on data displayed on PegCheck.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>3. Premium Subscription</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Premium subscriptions are billed at £4.99 per month via Stripe. You may cancel at any time. Cancellation takes effect at the end of the current billing period. Refunds are not provided for partial months. FintechCheck reserves the right to change pricing with 30 days notice.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>4. Alert Service</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Premium subscribers receive email alerts when stablecoin prices drop below defined thresholds. FintechCheck does not guarantee delivery of alerts and accepts no liability for missed alerts due to technical failures, email provider issues or any other reason. Alerts are informational only and do not constitute financial advice.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>5. Limitation of Liability</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>To the maximum extent permitted by law, FintechCheck shall not be liable for any direct, indirect, incidental, special or consequential damages arising from your use of PegCheck, including but not limited to financial losses, loss of data or loss of profits.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>6. Contact</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>For any questions regarding these terms please contact us at matsblocknode1957@gmail.com</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "16px 20px", border: `1px solid ${cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "13px", color: textSecondary }}>Built by FintechCheck</span>
        <a href="https://pegcheck.uk" style={{ fontSize: "13px", color: "#1a56db", fontWeight: "600", textDecoration: "none" }}>pegcheck.uk</a>
      </div>

      <div style={{ padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: dark ? "#374151" : "#d1d5db", fontFamily: "monospace" }}>© 2026 FintechCheck. All rights reserved.</span>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>About</span>
        </a>
      </div>

    </main>
  );
}