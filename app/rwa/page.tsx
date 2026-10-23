"use client";
import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

interface RwaAsset {
  name: string;
  issuer: string;
  chain: string;
  nav: number | null;
  navUpdatedAt: string | null;
  navContinuous: boolean;
  supply: number | null;
  supplyUsd: number | null;
  oracleDivergence: boolean;
}

function fmtNav(nav: number | null): string {
  if (nav == null) return "—";
  return "$" + nav.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtTokens(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtUpdated(asset: RwaAsset): string {
  if (asset.navContinuous) return "Updates continuously";
  if (!asset.navUpdatedAt) return "Updated by issuer";
  const d = new Date(asset.navUpdatedAt);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "UTC",
  }).replace(",", "") + " UTC";
}

export default function RwaPage() {
  const [assets, setAssets] = useState<RwaAsset[]>([]);
  const [lastUpdated, setLastUpdated] = useState("Loading...");
  const [fetchFailed, setFetchFailed] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pegcheck-dark") === "true";
    return false;
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch("/api/rwa", { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.assets) || data.assets.length === 0) throw new Error("no assets");
        setAssets(data.assets);
        setFetchFailed(false);
        setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        setFetchFailed(true);
        setLastUpdated("Unavailable");
      }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  }, []);

  const bg            = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg      = dark ? "#0d1628" : "#ffffff";
  const headerBorder  = dark ? "#1e2a40" : "#eaecf0";
  const cardBg        = dark ? "#0d1628" : "#ffffff";
  const cardBorder    = dark ? "#1e2a40" : "#eaecf0";
  const textPrimary   = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#6b7280";
  const innerBg       = dark ? "#080e1a" : "#f8f9fb";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <span style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>Tokenised Treasuries</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace" }}>{lastUpdated === "Unavailable" ? "Unavailable" : `Updated ${lastUpdated}`}</div>
          <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #0a1220 0%, #0d1e38 100%)", padding: "32px 20px 28px", borderBottom: "1px solid #1e2a40", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "18px", marginBottom: "16px", boxShadow: "0 8px 32px rgba(26,86,219,0.4)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="22" x2="21" y2="22"/>
            <line x1="6" y1="18" x2="6" y2="11"/>
            <line x1="10" y1="18" x2="10" y2="11"/>
            <line x1="14" y1="18" x2="14" y2="11"/>
            <line x1="18" y1="18" x2="18" y2="11"/>
            <polygon points="12 2 20 7 4 7"/>
          </svg>
        </div>
        <div style={{ fontSize: "22px", fontWeight: "800", color: "#f9fafb", marginBottom: "8px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Tokenised Treasuries
        </div>
        <div style={{ fontSize: "13px", color: "#9ca3af", maxWidth: "320px", margin: "0 auto" }}>
          Official value (NAV) of each token, read live from the issuer&apos;s own on-chain feed.
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
        {assets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: textSecondary, fontSize: "13px" }}>
            {fetchFailed
              ? "Couldn't load the values right now. Try again in a minute."
              : "Loading…"}
          </div>
        ) : assets.map((asset) => (
          <div key={asset.name} style={{ background: cardBg, borderRadius: "12px", padding: "18px 20px", border: `1px solid ${cardBorder}` }}>

            {/* Token name + issuer */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "18px", fontWeight: "800", color: textPrimary, letterSpacing: "-0.3px" }}>{asset.name}</span>
              <span style={{ fontSize: "11px", color: textSecondary }}>{asset.issuer} · {asset.chain}</span>
            </div>

            {/* NAV */}
            <div style={{ background: innerBg, borderRadius: "10px", padding: "14px 16px", marginBottom: "10px", border: `1px solid ${cardBorder}` }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Net Asset Value</div>
              <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: "700", color: asset.nav != null ? textPrimary : textSecondary }}>
                {fmtNav(asset.nav)}
              </div>
              <div style={{ fontSize: "11px", color: textSecondary, marginTop: "4px" }}>
                {fmtUpdated(asset)}
                {asset.oracleDivergence && (
                  <span style={{ marginLeft: "8px", color: "#d97706", fontWeight: "700" }}>⚠ oracle divergence</span>
                )}
              </div>
            </div>

            {/* Supply + TVL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: innerBg, borderRadius: "8px", padding: "10px 12px", border: `1px solid ${cardBorder}` }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Supply</div>
                <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "600", color: textPrimary }}>{fmtTokens(asset.supply)}</div>
                <div style={{ fontSize: "10px", color: textSecondary, marginTop: "2px" }}>tokens</div>
              </div>
              <div style={{ background: innerBg, borderRadius: "8px", padding: "10px 12px", border: `1px solid ${cardBorder}` }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>TVL</div>
                <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "600", color: textPrimary }}>{fmtUsd(asset.supplyUsd)}</div>
                <div style={{ fontSize: "10px", color: textSecondary, marginTop: "2px" }}>on Ethereum</div>
              </div>
            </div>

          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af" }}>Not financial advice</div>
      </div>

      <BottomNav dark={dark} />
    </main>
  );
}
