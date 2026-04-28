"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const CONTRACT_ADDRESS = "0xA00cbfF342F9009B23f08A0ED3c9918D2B5C86fa";
const ABI = ["function getDepegEvents() external view returns (tuple(string symbol, uint256 price, uint256 timestamp, string severity)[])"];

interface DepegEvent {
  symbol: string;
  price: bigint;
  timestamp: bigint;
  severity: string;
}

export default function OnchainPage() {
  const [events, setEvents] = useState<DepegEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { ethers } = await import("ethers");
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
        if (!rpcUrl) throw new Error("RPC URL not configured");
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const raw = await contract.getDepegEvents();
        setEvents([...raw].reverse());
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch on-chain events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";

  const severityColor = (s: string) => s === "depegged" ? "#dc2626" : "#d97706";
  const severityBg = (s: string) =>
    dark
      ? s === "depegged" ? "#450a0a" : "#451a03"
      : s === "depegged" ? "#fef2f2" : "#fffbeb";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", textDecoration: "none", color: textPrimary, fontSize: "16px" }}>←</Link>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>On-Chain Depeg Log</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>Sepolia Testnet</div>
          </div>
        </div>
        <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "16px 20px", border: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "11px", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Smart Contract</div>
          <div style={{ fontFamily: "monospace", fontSize: "11px", color: textPrimary, wordBreak: "break-all" }}>{CONTRACT_ADDRESS}</div>
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", background: "#1a56db", color: "#ffffff", fontSize: "12px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          View on Etherscan →
        </a>
      </div>

      <div style={{ margin: "16px 20px 0" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>
          Depeg Events {!loading && !error && <span style={{ fontWeight: "400", color: textSecondary }}>({events.length})</span>}
        </div>

        {loading && (
          <div style={{ background: cardBg, borderRadius: "12px", padding: "32px 20px", border: `1px solid ${cardBorder}`, textAlign: "center", color: textSecondary, fontSize: "13px" }}>
            Reading from blockchain...
          </div>
        )}

        {error && (
          <div style={{ background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid #450a0a`, textAlign: "center", color: "#ef4444", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={{ background: cardBg, borderRadius: "12px", padding: "40px 20px", border: `1px solid ${cardBorder}`, textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>✅</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: textPrimary, marginBottom: "6px" }}>No depeg events recorded on-chain yet</div>
            <div style={{ fontSize: "12px", color: textSecondary }}>The blockchain record is clean.</div>
          </div>
        )}

        {!loading && !error && events.map((ev, i) => {
          const price = Number(ev.price) / 1e8;
          const ts = new Date(Number(ev.timestamp) * 1000);
          return (
            <div key={i} style={{ background: cardBg, borderRadius: "12px", padding: "16px 20px", border: `1px solid ${cardBorder}`, marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: dark ? "#1e2a40" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "11px", color: textPrimary, flexShrink: 0 }}>
                  {ev.symbol}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "700", fontFamily: "monospace", color: "#dc2626" }}>${price.toFixed(4)}</span>
                    <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: severityBg(ev.severity), color: severityColor(ev.severity), textTransform: "uppercase", letterSpacing: "0.5px" }}>{ev.severity}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: textSecondary }}>
                    {ts.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace", textAlign: "right" }}>
                Block #{(i + 1).toString().padStart(4, "0")}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af" }}>Powered by Ethereum · Sepolia Testnet</div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
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
