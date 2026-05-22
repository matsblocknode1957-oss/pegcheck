
"use client";
import { useState } from "react";

export default function PrivacyPage() {
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
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>Privacy Policy</span>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>Privacy Policy</div>
        <p style={{ fontSize: "12px", color: textSecondary, margin: "0 0 16px 0" }}>Last updated: March 2026</p>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>This Privacy Policy explains how FintechCheck collects, uses and protects your personal data when you use PegCheck. By using PegCheck you agree to this policy.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>1. What We Collect</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>We collect only the information necessary to provide the service. For free users this is limited to anonymised analytics data via Google Analytics. For premium subscribers we collect your email address and payment information. Payment data is processed securely by Stripe and we never store your card details directly.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>2. How We Use Your Data</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Your email address is used solely to send depeg alert emails that you have subscribed to. We do not sell your data to third parties. We do not use your data for advertising purposes. We do not share your data with anyone except the services required to operate PegCheck — Supabase for database storage, Stripe for payments and Resend for email delivery.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>3. Data Storage</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Your email address and subscription status are stored securely in Supabase, a GDPR-compliant database provider. Data is stored in the EU. We retain your data for as long as your subscription is active. Upon cancellation your data is deleted within 30 days on request.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>4. Your Rights</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>Under GDPR you have the right to access the data we hold about you, request correction of inaccurate data, request deletion of your data, and withdraw consent at any time. To exercise any of these rights please contact us at matsblocknode1957@gmail.com and we will respond within 30 days.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>5. Cookies</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>PegCheck uses Google Analytics to understand how visitors use the site. This uses cookies to collect anonymised usage data. No personally identifiable information is collected through analytics. You can disable cookies in your browser settings at any time.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>6. Contact</div>
        <p style={{ fontSize: "14px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>For any privacy related questions please contact us at matsblocknode1957@gmail.com</p>
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
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>History</span>
        </a>
      </div>

    </main>
  );
}