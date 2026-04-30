"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const TEST_KEY = "pk_live_test123";

interface Coin {
  slug: string;
  price: number;
  deviation: number;
  status: string;
  updated_at: string;
}

const CODE_SNIPPET = `fetch("https://pegcheck.uk/api/v1/coins", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})
  .then(res => res.json())
  .then(data => console.log(data.coins));`;

export default function DemoPage() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const fetchCoins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/v1/coins", {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      const data = await res.json();
      if (data.coins) {
        setCoins(data.coins);
        setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setError(null);
      } else {
        setError(data.error ?? "Failed to load coins");
      }
    } catch {
      setError("Network error — could not reach API");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins();
    const interval = setInterval(() => fetchCoins(true), 30000);
    return () => clearInterval(interval);
  }, [fetchCoins]);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const codeBg = dark ? "#060b14" : "#f1f5f9";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";

  const statusColor = (s: string) =>
    s === "stable" || s === "Healthy" ? "#16a34a" :
    s === "warning" || s === "Caution" ? "#d97706" : "#dc2626";

  const statusBg = (s: string) => {
    if (dark) {
      return s === "stable" || s === "Healthy" ? "#052e16" :
             s === "warning" || s === "Caution" ? "#451a03" : "#450a0a";
    }
    return s === "stable" || s === "Healthy" ? "#f0fdf4" :
           s === "warning" || s === "Caution" ? "#fffbeb" : "#fef2f2";
  };

  const statusLabel = (s: string) =>
    s === "stable" ? "Healthy" :
    s === "warning" ? "Caution" :
    s === "depegged" ? "Depeg" : s;

  const COIN_NAMES: Record<string, string> = {
    usdt: "Tether", usdc: "Circle", usds: "MakerDAO", ethena: "Ethena Labs",
    pyusd: "PayPal", fdusd: "First Digital", rlusd: "Ripple", tusd: "TrueUSD",
  };

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px", transition: "background 0.2s ease" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: "16px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", textDecoration: "none", color: textPrimary, fontSize: "16px" }}>←</Link>
          <div>
            <div style={{ fontSize: "17px", fontWeight: "700", color: textPrimary, lineHeight: "1.2" }}>API Demo</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "2px" }}>Live data via PegCheck API</div>
          </div>
        </div>
        <button onClick={toggleDark} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Intro */}
      <div style={{ margin: "16px 20px 0", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "12px", padding: "20px" }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#ffffff", marginBottom: "6px" }}>Live API Preview</div>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5", marginBottom: "16px" }}>
          Real stablecoin data fetched right now using the PegCheck REST API. Refreshes every 30 seconds automatically.
        </div>
        <Link href="/developers" style={{ display: "inline-block", background: "#ffffff", color: "#1a56db", padding: "9px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", textDecoration: "none" }}>
          Get your free API key →
        </Link>
      </div>

      {/* Status bar */}
      <div style={{ margin: "12px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>
          Stablecoins {!loading && <span style={{ fontWeight: "400", color: textSecondary }}>({coins.length})</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {refreshing && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1a56db", animation: "pulse 1s infinite" }} />}
          {lastUpdated && <div style={{ fontSize: "11px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>}
        </div>
      </div>

      {/* Coin list */}
      <div style={{ margin: "10px 20px 0" }}>
        {loading && (
          <div style={{ background: cardBg, borderRadius: "12px", padding: "32px 20px", border: `1px solid ${cardBorder}`, textAlign: "center", color: textSecondary, fontSize: "13px" }}>
            Fetching live data...
          </div>
        )}

        {error && (
          <div style={{ background: cardBg, borderRadius: "12px", padding: "20px", border: "1px solid #450a0a", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {!loading && !error && coins.map((coin) => (
          <div key={coin.slug} style={{ background: cardBg, borderRadius: "12px", padding: "14px 16px", border: `1px solid ${cardBorder}`, marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={`/icons/${coin.slug}.png`} alt={coin.slug} style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: textPrimary, textTransform: "uppercase" }}>{coin.slug}</div>
                <div style={{ fontSize: "11px", color: textSecondary }}>{COIN_NAMES[coin.slug] ?? ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "monospace", color: textPrimary }}>${coin.price.toFixed(4)}</div>
                <div style={{ fontSize: "11px", color: coin.deviation >= 0 ? "#16a34a" : "#dc2626", fontFamily: "monospace" }}>
                  {coin.deviation >= 0 ? "+" : ""}{coin.deviation.toFixed(4)}%
                </div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", background: statusBg(coin.status), color: statusColor(coin.status), whiteSpace: "nowrap" }}>
                {statusLabel(coin.status)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Code snippet */}
      <div style={{ margin: "20px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>How to integrate</div>
          <button onClick={handleCopy} style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${cardBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", color: textSecondary, fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre style={{ margin: 0, padding: "14px 16px", background: codeBg, borderRadius: "8px", fontSize: "12px", lineHeight: "1.7", color: dark ? "#93c5fd" : "#1e40af", overflowX: "auto", fontFamily: "monospace", whiteSpace: "pre" }}>
          {CODE_SNIPPET}
        </pre>
        <div style={{ marginTop: "12px", fontSize: "12px", color: textSecondary, lineHeight: "1.5" }}>
          Returns JSON with <code style={{ background: codeBg, padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>coins[]</code> — each with <code style={{ background: codeBg, padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>slug</code>, <code style={{ background: codeBg, padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>price</code>, <code style={{ background: codeBg, padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>status</code>, <code style={{ background: codeBg, padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}>deviation</code>, and more.
        </div>
      </div>

      {/* CTA */}
      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${cardBorder}`, textAlign: "center" }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: textPrimary, marginBottom: "6px" }}>Ready to build?</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginBottom: "16px", lineHeight: "1.5" }}>
          Start free — 30 day trial, no credit card required. Full API docs included.
        </div>
        <Link href="/developers" style={{ display: "inline-block", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", color: "#ffffff", padding: "11px 24px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", textDecoration: "none" }}>
          Get your free API key →
        </Link>
        <div style={{ marginTop: "10px" }}>
          <Link href="/developers/docs" style={{ fontSize: "12px", color: "#1a56db", textDecoration: "none" }}>View full API docs →</Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af" }}>Not financial advice</div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>Home</span>
        </a>
        <a href="/developers" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>API</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: dark ? "#6b7280" : "#9ca3af" }}>About</span>
        </a>
      </div>

    </main>
  );
}
