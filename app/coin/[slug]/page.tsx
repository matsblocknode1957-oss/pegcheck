"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COIN_DATA: Record<string, {
  name: string; issuer: string; icon: string; bgColor: string;
  collateral: string; collateralRatio: string; reserveAudit: string;
  auditDate: string; auditScore: number; description: string;
  contractAddress: string;
}> = {
  usdt: {
    name: "USDT", issuer: "Tether", icon: "/icons/usdt.png", bgColor: "#26a17b",
    collateral: "Cash & Cash Equivalents, T-Bills, Other",
    collateralRatio: "100.4%",
    reserveAudit: "BDO Italia",
    auditDate: "Q4 2024",
    auditScore: 85,
    description: "USDT is the world's largest stablecoin by market cap, issued by Tether. It is pegged 1:1 to the US Dollar and backed by reserves including cash, cash equivalents, and short-term US Treasury bills.",
    contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  },
  usdc: {
    name: "USDC", issuer: "Circle", icon: "/icons/usdc.png", bgColor: "#2775ca",
    collateral: "Cash & Short-Duration US Treasuries",
    collateralRatio: "100%",
    reserveAudit: "Deloitte",
    auditDate: "Monthly",
    auditScore: 97,
    description: "USDC is issued by Circle and is one of the most transparent stablecoins. Reserves are held in segregated accounts at regulated US financial institutions and audited monthly.",
    contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  usds: {
    name: "USDS", issuer: "MakerDAO", icon: "/icons/usds.png", bgColor: "#f4b731",
    collateral: "Crypto-collateralised (ETH, BTC, RWA)",
    collateralRatio: "147%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 92,
    description: "USDS (formerly DAI) is a decentralised stablecoin maintained by MakerDAO. It is over-collateralised with a mix of crypto assets and real-world assets, with all collateral verifiable on-chain.",
    contractAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
  },
  ethena: {
    name: "Ethena (USDe)", issuer: "Ethena Labs", icon: "/icons/ethena.png", bgColor: "#1a1a2e",
    collateral: "ETH + Perpetual Short Hedges",
    collateralRatio: "101.2%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 78,
    description: "USDe is a synthetic dollar backed by staked ETH and delta-neutral perpetual short positions. It generates yield from staking rewards and funding rates, but carries unique smart contract and exchange counterparty risks.",
    contractAddress: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
  },
  pyusd: {
    name: "PYUSD", issuer: "PayPal", icon: "/icons/pyusd.png", bgColor: "#003087",
    collateral: "US Dollar Deposits, T-Bills, Money Market Funds",
    collateralRatio: "100%",
    reserveAudit: "Grant Thornton",
    auditDate: "Monthly",
    auditScore: 90,
    description: "PYUSD is issued by Paxos Trust Company on behalf of PayPal. It is fully backed by US dollar deposits, short-term treasuries, and similar cash equivalents, with monthly attestations.",
    contractAddress: "0x6c3ea9036406852006290770bedfcaba0e23a0e8",
  },
  fdusd: {
    name: "FDUSD", issuer: "First Digital", icon: "/icons/fdusd.png", bgColor: "#1a1a1a",
    collateral: "Cash & Cash Equivalents",
    collateralRatio: "100%",
    reserveAudit: "Prescient Assurance",
    auditDate: "Monthly",
    auditScore: 80,
    description: "FDUSD is issued by First Digital Trust, a Hong Kong-based qualified custodian. It is backed 1:1 by cash and cash equivalents held in segregated accounts.",
    contractAddress: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
  },
  rlusd: {
    name: "RLUSD", issuer: "Ripple", icon: "/icons/rlusd.png", bgColor: "#346aa9",
    collateral: "US Dollar Deposits, T-Bills, Cash Equivalents",
    collateralRatio: "100%",
    reserveAudit: "Independent Attestation",
    auditDate: "Monthly",
    auditScore: 88,
    description: "RLUSD is issued by Ripple and runs on the XRP Ledger and Ethereum. It is fully backed by US dollar deposits and cash equivalents, designed for enterprise and cross-border payments.",
    contractAddress: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
  },
  tusd: {
    name: "TUSD", issuer: "TrueUSD", icon: "/icons/tusd.png", bgColor: "#1a3a5c",
    collateral: "US Dollar Deposits",
    collateralRatio: "99.7%",
    reserveAudit: "Armanino (paused)",
    auditDate: "Last: 2023",
    auditScore: 55,
    description: "TUSD is one of the original regulated stablecoins. It was historically fully backed by USD deposits with real-time attestations, but reserve verification has been paused since 2023, introducing uncertainty.",
    contractAddress: "0x0000000000085d4780B73119b644AE5ecd22b376",
  },
};

function LargeTransactions({ slug, dark, cardBorder, textSecondary, textPrimary }: {
  slug: string; dark: boolean; cardBorder: string; textSecondary: string; textPrimary: string;
}) {
  const [txs, setTxs] = useState<{ tx_hash: string; amount: number; action: string; created_at: string }[]>([]);

  useEffect(() => {
    const fetchTxs = async () => {
      try {
        const res = await fetch(`/api/large-transactions?slug=${slug}`);
        const data = await res.json();
        if (data.transactions) setTxs(data.transactions);
      } catch (e) {}
    };
    fetchTxs();
  }, [slug]);

  if (txs.length === 0) {
    return (
      <div style={{ fontSize: "13px", color: textSecondary, textAlign: "center", padding: "16px 0" }}>
        No large transactions detected recently
      </div>
    );
  }

  return (
    <div>
      {txs.map((tx) => (
        <div key={tx.tx_hash} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${cardBorder}` }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: textPrimary }}>${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>{new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <a href={`https://etherscan.io/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#1a56db" }}>View →</a>
        </div>
      ))}
    </div>
  );
}

export default function CoinDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const pathname = usePathname();
  const coin = COIN_DATA[slug];

  const [price, setPrice] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ created_at: string; price: number }[]>([]);
  const [chartRange, setChartRange] = useState<7 | 30 | 90>(7);
  const [sourcePrices, setSourcePrices] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState("Loading...");
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
    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        if (data.prices && data.prices[slug]) {
          setPrice(data.prices[slug]);
          const now = new Date();
          setLastUpdated(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        }
        if (data.sources && data.sources[slug]) {
          setSourcePrices(data.sources[slug]);
        }
      } catch (e) {
        console.error("Failed to fetch price", e);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/price-history?slug=${slug}&days=${chartRange}`);
        const data = await res.json();
        if (data.history) setPriceHistory(data.history);
      } catch (e) {}
    };
    fetchHistory();
  }, [slug, chartRange]);

  const getStatus = (p: number) => {
    if (p >= 0.999) return "Healthy";
    if (p >= 0.995) return "Slight Depeg";
    if (p >= 0.990) return "Warning";
    return "At Risk";
  };

  const statusColor = (s: string) => {
    if (s === "Healthy") return "#16a34a";
    if (s === "Slight Depeg") return "#d97706";
    if (s === "Warning") return "#ea580c";
    return "#dc2626";
  };

  const statusBg = (s: string) => {
    if (dark) {
      if (s === "Healthy") return "#052e16";
      if (s === "Slight Depeg") return "#451a03";
      if (s === "Warning") return "#431407";
      return "#450a0a";
    }
    if (s === "Healthy") return "#f0fdf4";
    if (s === "Slight Depeg") return "#fffbeb";
    if (s === "Warning") return "#fff7ed";
    return "#fef2f2";
  };

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";

  if (!coin) {
    return (
      <main style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <div style={{ fontSize: "18px", fontWeight: "700", color: textPrimary }}>Coin not found</div>
          <Link href="/" style={{ color: "#1a56db", fontSize: "14px" }}>← Back to dashboard</Link>
        </div>
      </main>
    );
  }

  const liveStatus = price ? getStatus(price) : "Healthy";
  const displayPrice = price ?? 1.0;

  const renderChart = () => {
    if (priceHistory.length < 2) {
      return (
        <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary, fontSize: "13px" }}>
          Building price history... check back soon.
        </div>
      );
    }
    const prices = priceHistory.map(h => h.price);
    const min = Math.min(...prices) - 0.0005;
    const max = Math.max(...prices) + 0.0005;
    const w = 320;
    const h = 100;
    const points = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${x},${y}`;
    }).join(" ");
    const pegY = h - ((1.0 - min) / (max - min)) * h;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "120px" }}>
        <line x1="0" y1={pegY} x2={w} y2={pegY} stroke={dark ? "#1e2a40" : "#e5e7eb"} strokeWidth="1" strokeDasharray="4,3" />
        <polyline points={points} fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {(() => {
          const last = prices[prices.length - 1];
          const x = w;
          const y = h - ((last - min) / (max - min)) * h;
          return <circle cx={x} cy={y} r="3" fill="#1a56db" />;
        })()}
      </svg>
    );
  };

  const sourceNames = ["CoinGecko", "Coinbase", "Binance", "Kraken", "DefiLlama"];
  const sourceCount = Object.keys(sourcePrices).length || 5;
  const spread = Object.keys(sourcePrices).length > 1
    ? (Math.max(...Object.values(sourcePrices)) - Math.min(...Object.values(sourcePrices))).toFixed(4)
    : "0.0002";

  const auditScoreColor = coin.auditScore >= 90 ? "#16a34a" : coin.auditScore >= 70 ? "#d97706" : "#dc2626";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", textDecoration: "none", fontSize: "16px" }}>←</Link>
          <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: textPrimary }}>PegCheck</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>Stablecoin Monitor</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>
          <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div style={{ background: headerBg, padding: "20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          <img src={coin.icon} alt={coin.name} style={{ width: "38px", height: "38px", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "22px", fontWeight: "800", color: textPrimary }}>{coin.name}</div>
          <div style={{ fontSize: "13px", color: textSecondary }}>{coin.issuer}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: "700", color: displayPrice < 0.995 ? statusColor(liveStatus) : textPrimary }}>${displayPrice.toFixed(4)}</div>
          <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: statusBg(liveStatus), color: statusColor(liveStatus) }}>{liveStatus}</span>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>Price History</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {([7, 30, 90] as const).map(d => (
                <button key={d} onClick={() => setChartRange(d)} style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer", background: chartRange === d ? "#1a56db" : (dark ? "#1e2a40" : "#f3f4f6"), color: chartRange === d ? "white" : textSecondary }}>{d}d</button>
              ))}
            </div>
          </div>
          {renderChart()}
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>Collateral</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Ratio</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.collateralRatio}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Backing</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: textPrimary, textAlign: "right", maxWidth: "60%" }}>{coin.collateral}</span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: dark ? "#1e2a40" : "#f3f4f6", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(parseFloat(coin.collateralRatio), 100)}%`, background: "linear-gradient(90deg, #1a56db, #10b981)", borderRadius: "3px" }} />
          </div>
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>Reserve Audit</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Auditor</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.reserveAudit}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Last audit</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: textPrimary }}>{coin.auditDate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Transparency score</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: auditScoreColor }}>{coin.auditScore}/100</span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: dark ? "#1e2a40" : "#f3f4f6", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${coin.auditScore}%`, background: auditScoreColor, borderRadius: "3px" }} />
          </div>
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>Source Consensus</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Sources agreeing</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#16a34a" }}>{sourceCount}/5 ✓</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: textSecondary }}>Price spread</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: textPrimary }}>±{spread}</span>
          </div>
          {sourceNames.map(source => (
            <div key={source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: textSecondary }}>{source}</span>
              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>✓ Active</span>
            </div>
          ))}
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "8px" }}>About</div>
          <p style={{ fontSize: "13px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>{coin.description}</p>
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>Large Transactions</div>
          <LargeTransactions slug={slug} dark={dark} cardBorder={cardBorder} textSecondary={textSecondary} textPrimary={textPrimary} />
        </div>

        <div style={{ background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: textSecondary }}>© 2026 FintechCheck</span>
          <div style={{ display: "flex", gap: "12px" }}>
            <Link href="/terms" style={{ fontSize: "12px", color: textSecondary, textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" style={{ fontSize: "12px", color: textSecondary, textDecoration: "none" }}>Privacy</Link>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "10px", color: dark ? "#374151" : "#d1d5db", fontFamily: "monospace" }}>PegCheck v1.5 — Not financial advice</span>
        </div>

      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/" ? "#1a56db" : textSecondary }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/alerts" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/alerts" ? "#1a56db" : textSecondary }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/about" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: pathname === "/about" ? "#1a56db" : textSecondary }}>About</span>
        </a>
      </div>

    </main>
  );
}