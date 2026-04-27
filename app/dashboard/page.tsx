"use client";

import { useState } from "react";

type KeyData = {
  found: true;
  key: string;
  tier: string;
  calls_used: number;
  calls_limit: number | null;
  calls_remaining: number | null;
  created_at: string;
};

type NotFound = { found: false };
type Result = KeyData | NotFound;

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const TIER_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  starter: { text: "#60a5fa", bg: "#0c1a2e", border: "#1e3a5f" },
  pro:     { text: "#a78bfa", bg: "#130c2e", border: "#2e1e5f" },
  enterprise: { text: "#34d399", bg: "#0c1f18", border: "#1e4035" },
};

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bg = "#0a0e1a";
  const cardBg = "#0d1628";
  const border = "#1e2a40";
  const textPrimary = "#f9fafb";
  const textSecondary = "#6b7280";

  const tierStyle = result?.found ? (TIER_COLORS[result.tier] ?? TIER_COLORS.starter) : null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function usagePercent(used: number, limit: number) {
    return Math.min(100, Math.round((used / limit) * 100));
  }

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "40px" }}>

      {/* Header */}
      <div style={{ background: "#0d1628", padding: "14px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: "12px" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>PegCheck</span>
        </a>
        <span style={{ color: border, fontSize: "18px" }}>|</span>
        <span style={{ fontSize: "14px", fontWeight: "600", color: textSecondary }}>API Dashboard</span>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>

        {/* Lookup form */}
        <div style={{ background: cardBg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: textPrimary, margin: "0 0 6px" }}>Your API Key</h1>
          <p style={{ fontSize: "13px", color: textSecondary, margin: "0 0 20px", lineHeight: "1.5" }}>
            Enter the email address you used when signing up to retrieve your key and usage stats.
          </p>
          <form onSubmit={handleLookup} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              style={{
                background: "#080e1a",
                border: `1px solid ${error ? "#dc2626" : border}`,
                borderRadius: "10px",
                padding: "12px 14px",
                color: textPrimary,
                fontSize: "14px",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            {error && <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#1e2a40" : "linear-gradient(135deg, #1a56db, #0e3fa8)",
                color: loading ? textSecondary : "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Looking up…" : "Look up my key"}
            </button>
          </form>
        </div>

        {/* Not found */}
        {result && !result.found && (
          <div style={{ background: cardBg, borderRadius: "16px", border: `1px solid ${border}`, padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
            <p style={{ fontSize: "15px", fontWeight: "600", color: textPrimary, margin: "0 0 8px" }}>No API key found</p>
            <p style={{ fontSize: "13px", color: textSecondary, margin: "0 0 20px", lineHeight: "1.6" }}>
              We couldn&apos;t find an active API key for <strong style={{ color: textPrimary }}>{email}</strong>.
              Make sure you&apos;re using the email address you signed up with, or check your inbox for the key email.
            </p>
            <a
              href="/developers"
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #1a56db, #0e3fa8)",
                color: "white",
                textDecoration: "none",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Sign up for API access →
            </a>
          </div>
        )}

        {/* Found */}
        {result?.found && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Tier badge + key */}
            <div style={{ background: cardBg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <span style={{ fontSize: "13px", color: textSecondary }}>Plan</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: tierStyle!.text,
                  background: tierStyle!.bg,
                  border: `1px solid ${tierStyle!.border}`,
                  borderRadius: "20px",
                  padding: "3px 12px",
                  letterSpacing: "0.3px",
                }}>
                  {TIER_LABELS[result.tier] ?? result.tier}
                </span>
              </div>

              <div style={{ marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>API Key</span>
              </div>
              <div style={{
                background: "#080e1a",
                border: `1px solid ${border}`,
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#60a5fa", wordBreak: "break-all", flex: 1 }}>
                  {result.key}
                </span>
                <button
                  onClick={() => copyKey(result.key)}
                  style={{
                    background: copied ? "#052e16" : "#1e2a40",
                    border: `1px solid ${copied ? "#16a34a" : border}`,
                    borderRadius: "8px",
                    padding: "6px 12px",
                    color: copied ? "#4ade80" : textSecondary,
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>

              <div style={{ marginTop: "14px", fontSize: "12px", color: textSecondary }}>
                Active since {formatDate(result.created_at)}
              </div>
            </div>

            {/* Usage */}
            <div style={{ background: cardBg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: textPrimary, margin: "0 0 16px" }}>Usage this month</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: result.calls_limit ? "16px" : "0" }}>
                <div style={{ background: "#080e1a", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: textPrimary, fontFamily: "monospace" }}>
                    {result.calls_used.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11px", color: textSecondary, marginTop: "2px" }}>calls used</div>
                </div>
                <div style={{ background: "#080e1a", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: result.calls_remaining === 0 ? "#f87171" : "#4ade80", fontFamily: "monospace" }}>
                    {result.calls_remaining !== null ? result.calls_remaining.toLocaleString() : "∞"}
                  </div>
                  <div style={{ fontSize: "11px", color: textSecondary, marginTop: "2px" }}>calls remaining</div>
                </div>
              </div>

              {result.calls_limit !== null && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: textSecondary, marginBottom: "6px" }}>
                    <span>{usagePercent(result.calls_used, result.calls_limit)}% used</span>
                    <span>{result.calls_limit.toLocaleString()} / month</span>
                  </div>
                  <div style={{ background: "#080e1a", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: "999px",
                      width: `${usagePercent(result.calls_used, result.calls_limit)}%`,
                      background: usagePercent(result.calls_used, result.calls_limit) >= 90
                        ? "linear-gradient(90deg, #dc2626, #f87171)"
                        : usagePercent(result.calls_used, result.calls_limit) >= 70
                          ? "linear-gradient(90deg, #d97706, #fbbf24)"
                          : "linear-gradient(90deg, #1a56db, #60a5fa)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </>
              )}

              {result.calls_limit === null && (
                <div style={{ background: "#080e1a", borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#34d399", fontSize: "14px" }}>∞</span>
                  <span style={{ fontSize: "13px", color: textSecondary }}>Unlimited calls on Enterprise</span>
                </div>
              )}
            </div>

            {/* Quick start */}
            <div style={{ background: cardBg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: textPrimary, margin: "0 0 12px" }}>Quick start</p>
              <div style={{ background: "#080e1a", borderRadius: "10px", padding: "14px", fontFamily: "monospace", fontSize: "12px", color: "#9ca3af", overflowX: "auto" }}>
                <span style={{ color: "#60a5fa" }}>fetch</span>
                <span>(</span>
                <span style={{ color: "#4ade80" }}>&quot;https://pegcheck.uk/api/v1/coins&quot;</span>
                <span>, {"{"}</span>
                <br />
                <span style={{ paddingLeft: "16px" }}>headers: {"{"} </span>
                <span style={{ color: "#fbbf24" }}>Authorization</span>
                <span>: </span>
                <span style={{ color: "#4ade80" }}>&quot;Bearer </span>
                <span style={{ color: "#60a5fa" }}>{result.key.slice(0, 18)}…</span>
                <span style={{ color: "#4ade80" }}>&quot;</span>
                <span> {"}"}</span>
                <br />
                <span>{"}"}</span>
                <span>)</span>
              </div>
              <a
                href="/developers/docs"
                style={{ display: "inline-block", marginTop: "12px", fontSize: "12px", color: "#60a5fa", textDecoration: "none" }}
              >
                View full API docs →
              </a>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
