"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

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
  frax: {
    name: "FRAX", issuer: "Frax Finance", icon: "/icons/frax.png", bgColor: "#1c1c1c",
    collateral: "USDC + Algorithmic (Frax V3: fully collateralised)",
    collateralRatio: "~100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 72,
    description: "FRAX is a stablecoin from Frax Finance that began as fractional-algorithmic and has since moved to fully-collateralised backing in Frax v3. It is governed by the Frax DAO and deeply integrated into DeFi.",
    contractAddress: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  },
  gho: {
    name: "GHO", issuer: "Aave", icon: "/icons/gho.png", bgColor: "#b6509e",
    collateral: "Crypto-collateralised (Aave V3 deposits)",
    collateralRatio: ">100%",
    reserveAudit: "On-chain (Aave protocol)",
    auditDate: "Real-time",
    auditScore: 80,
    description: "GHO is a decentralised stablecoin native to the Aave protocol. It is minted by over-collateralised borrowers using assets supplied to Aave V3, with governance managed by Aave DAO.",
    contractAddress: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
  },
  crvusd: {
    name: "crvUSD", issuer: "Curve Finance", icon: "/icons/crvusd.png", bgColor: "#3a3a3a",
    collateral: "Crypto-collateralised (ETH, BTC, LSTs)",
    collateralRatio: ">100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 75,
    description: "crvUSD is the native stablecoin of Curve Finance, using the LLAMMA (Lending-Liquidating AMM Algorithm) system to gradually liquidate collateral rather than via sudden liquidations.",
    contractAddress: "0xf939E0A03FB07F59A73314E73794be0E57ac1b4E",
  },
  lusd: {
    name: "LUSD", issuer: "Liquity", icon: "/icons/lusd.png", bgColor: "#2eb6ae",
    collateral: "ETH (pure, no governance)",
    collateralRatio: ">110%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 88,
    description: "LUSD is the stablecoin of Liquity V1, backed purely by ETH. The protocol is fully immutable with no governance and no admin keys, making it one of the most trust-minimised stablecoins in DeFi.",
    contractAddress: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0",
  },
  usdp: {
    name: "USDP", issuer: "Paxos", icon: "/icons/usdp.png", bgColor: "#00735b",
    collateral: "Cash & Short-Term US Treasuries",
    collateralRatio: "100%",
    reserveAudit: "Withum Smith+Brown",
    auditDate: "Monthly",
    auditScore: 90,
    description: "USDP (Pax Dollar, formerly PAX) is issued by Paxos Trust Company, regulated by the NYDFS. It is fully backed by USD deposits and short-term US Treasuries held at US-regulated financial institutions.",
    contractAddress: "0x8E870D67F660D95d5be530380D0eC0bd388289E1",
  },
  usdd: {
    name: "USDD", issuer: "TRON DAO", icon: "/icons/usdd.png", bgColor: "#eb0029",
    collateral: "BTC, ETH, TRX (over-collateralised)",
    collateralRatio: ">200%",
    reserveAudit: "TRON DAO Reserve",
    auditDate: "Real-time",
    auditScore: 50,
    description: "USDD is a decentralised stablecoin managed by the TRON DAO Reserve, backed by a basket of BTC, ETH, and TRX. It has experienced significant depegging events and carries elevated counterparty risk.",
    contractAddress: "0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c9",
  },
  mkusd: {
    name: "mkUSD", issuer: "Prisma Finance", icon: "/icons/mkusd.png", bgColor: "#6b21a8",
    collateral: "Liquid Staking Tokens (wstETH, rETH, cbETH)",
    collateralRatio: ">100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 63,
    description: "mkUSD is the stablecoin of Prisma Finance, minted against liquid staking tokens. The protocol was affected by a security exploit in 2024, and is managed by the Prisma DAO.",
    contractAddress: "0x4591DBfF62656E7859Afe5e45f6f47D3669fBB28",
  },
  eurc: {
    name: "EURC", issuer: "Circle", icon: "/icons/eurc.png", bgColor: "#2563eb",
    collateral: "Euro Cash & Cash Equivalents",
    collateralRatio: "100%",
    reserveAudit: "Deloitte",
    auditDate: "Monthly",
    auditScore: 95,
    description: "EURC (Euro Coin) is issued by Circle, pegged 1:1 to the Euro. It is fully backed by Euro-denominated reserves at regulated European financial institutions. Note: EURC trades above $1 USD, reflecting EUR/USD exchange rates.",
    contractAddress: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
  },
  dola: {
    name: "DOLA", issuer: "Inverse Finance", icon: "/icons/dola.png", bgColor: "#1e3a5f",
    collateral: "Various DeFi collateral",
    collateralRatio: "~100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 58,
    description: "DOLA is the stablecoin of Inverse Finance. It has been affected by multiple protocol exploits, and the team has been working to repay outstanding bad debt and strengthen security measures.",
    contractAddress: "0x865377367054516e17014CcDed1e7d814EDC9ce4",
  },
  alusd: {
    name: "alUSD", issuer: "Alchemix", icon: "/icons/alusd.png", bgColor: "#f59e0b",
    collateral: "Yield-bearing stablecoins (yvDAI, yvUSDC)",
    collateralRatio: "~100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 72,
    description: "alUSD is a self-repaying synthetic stablecoin from Alchemix. It is minted against yield-bearing collateral and repays itself over time as the underlying collateral generates yield.",
    contractAddress: "0xBC6DA0FE9aD5f3b0d58160288917AA56653660e9",
  },
  bold: {
    name: "BOLD", issuer: "Liquity V2", icon: "/icons/bold.svg", bgColor: "#0f766e",
    collateral: "ETH + Liquid Staking Tokens",
    collateralRatio: ">100%",
    reserveAudit: "On-chain (public)",
    auditDate: "Real-time",
    auditScore: 85,
    description: "BOLD is the stablecoin of Liquity V2, supporting ETH and major liquid staking tokens as collateral. Like V1, the protocol is immutable and governance-free, while enabling multi-collateral positions.",
    contractAddress: "0x6440f144b7e50D3567575d8a5Dc73e046a8f6f54",
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
      <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px", background: "#052e16", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mint</span>
          <span style={{ fontSize: "11px", color: textSecondary }}>New tokens created</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px", background: "#450a0a", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px" }}>Burn</span>
          <span style={{ fontSize: "11px", color: textSecondary }}>Tokens destroyed</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px", background: "#1e2a40", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Transfer</span>
          <span style={{ fontSize: "11px", color: textSecondary }}>Large wallet move</span>
        </div>
      </div>
      {txs.map((tx) => (
        <div key={tx.tx_hash} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${cardBorder}` }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: textPrimary }}>${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px", background: tx.action === "mint" ? "#052e16" : tx.action === "burn" ? "#450a0a" : "#1e2a40", color: tx.action === "mint" ? "#10b981" : tx.action === "burn" ? "#ef4444" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{tx.action === "large_transfer" ? "Transfer" : tx.action}</span>
              <div style={{ fontSize: "11px", color: textSecondary }}>{new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
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
  const [chainlinkPor, setChainlinkPor] = useState<{ reserves: number; updated_at: string } | null>(null);
  const [uniswapData, setUniswapData] = useState<Record<string, { pool_price: number; consensus_price: number; divergence_bps: number }> | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
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
        if (data.uniswap) setUniswapData(data.uniswap);
      } catch (e) {
        console.error("Failed to fetch price", e);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  useEffect(() => {
    const fetchPoR = async () => {
      try {
        const res = await fetch(`/api/chainlink-por?slug=${slug}`);
        const data = await res.json();
        if (data.chainlink_por) setChainlinkPor(data.chainlink_por);
      } catch (e) {}
    };
    fetchPoR();
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

  const coinPeg = COIN_PEGS[slug] ?? 1.0;
  const { healthy: healthyT, caution: cautionT } = getThresholds(slug);

  const getStatus = (p: number) => {
    const diff = Math.abs(p - coinPeg) / coinPeg;
    if (diff <= healthyT) return "Healthy";
    if (diff <= cautionT) return "Caution";
    return "Depeg";
  };

  const statusColor = (s: string) => {
    if (s === "Healthy") return "#16a34a";
    if (s === "Caution") return "#d97706";
    return "#dc2626";
  };

  const statusBg = (s: string) => {
    if (dark) {
      if (s === "Healthy") return "#052e16";
      if (s === "Caution") return "#451a03";
      return "#450a0a";
    }
    if (s === "Healthy") return "#f0fdf4";
    if (s === "Caution") return "#fffbeb";
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
          <div style={{ fontSize: "16px", color: textPrimary }}>Coin not found</div>
          <Link href="/" style={{ fontSize: "13px", color: "#1a56db", marginTop: "8px", display: "block" }}>← Back to home</Link>
        </div>
      </main>
    );
  }

  const livePrice = price ?? coin.collateralRatio as unknown as number ?? 1.0;
  const currentPrice = price ?? 1.0;
  const status = getStatus(currentPrice);

  const minPrice = Math.min(...priceHistory.map(h => h.price), currentPrice);
  const maxPrice = Math.max(...priceHistory.map(h => h.price), currentPrice);
  const priceRange = maxPrice - minPrice || 0.001;

  // Chart coordinate constants: left margin for Y-axis, plot area bounds
  const CL = 50, CR = 398, CT = 10, CB = 182, CW = 348, CH = 172;
  const priceToY = (p: number) => CB - ((p - minPrice) / priceRange) * CH;
  const indexToX = (i: number) => CL + (i / Math.max(priceHistory.length - 1, 1)) * CW;
  const segColor = (p: number) => {
    const diff = Math.abs(p - coinPeg) / coinPeg;
    if (diff > cautionT) return "#ef4444";
    if (diff > healthyT) return "#f59e0b";
    return "#22c55e";
  };
  const yTicks = Array.from({ length: 4 }, (_, i) => minPrice + (i / 3) * priceRange);
  const pegY = CB - ((coinPeg - minPrice) / priceRange) * CH;
  const showPeg = pegY >= CT - 5 && pegY <= CB + 5;

  // Tooltip state derived for current render
  const hovPoint = hoveredIdx !== null ? (priceHistory[hoveredIdx] ?? null) : null;
  const hovX = hovPoint ? indexToX(hoveredIdx!) : 0;
  const hovY = hovPoint ? priceToY(hovPoint.price) : 0;
  const tipLeft = hovX > CL + CW / 2;
  const tbx = tipLeft ? hovX - 86 : hovX + 8;
  const tby = Math.max(CT + 2, hovY - 26);
  const hovDateStr = hovPoint ? new Date(hovPoint.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  const hovTimeStr = hovPoint ? new Date(hovPoint.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  const uniswapEntry = (slug === "usdc" || slug === "usdt") ? (uniswapData?.[slug] ?? null) : null;

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px", transition: "background 0.2s ease" }}>

      <div style={{ background: headerBg, padding: "14px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", textDecoration: "none", color: textPrimary, fontSize: "16px" }}>←</Link>
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src={coin.icon} alt={coin.name} style={{ width: "22px", height: "22px", objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: textPrimary }}>{coin.name}</div>
            <div style={{ fontSize: "11px", color: textSecondary }}>{coin.issuer}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "10px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>
          <button onClick={toggleDark} style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "32px", fontWeight: "800", fontFamily: "monospace", color: textPrimary }}>${currentPrice.toFixed(4)}</div>
            <div style={{ fontSize: "11px", color: textSecondary, marginTop: "2px" }}>Target: $1.0000</div>
          </div>
          <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "700", background: statusBg(status), color: statusColor(status) }}>{status}</span>
        </div>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>Price History</div>
          <div style={{ display: "flex", gap: "4px" }}>
            {([7, 30, 90] as const).map((d) => (
              <button key={d} onClick={() => setChartRange(d)} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${headerBorder}`, background: chartRange === d ? "#1a56db" : "transparent", color: chartRange === d ? "#ffffff" : textSecondary, fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>{d}d</button>
            ))}
          </div>
        </div>
        {priceHistory.length > 1 ? (
          <svg
            width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="none"
            style={{ display: "block", cursor: "crosshair" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const lx = ((e.clientX - rect.left) / rect.width) * 400;
              const rx = lx - CL;
              if (rx < 0 || rx > CW) { setHoveredIdx(null); return; }
              setHoveredIdx(Math.max(0, Math.min(priceHistory.length - 1, Math.round((rx / CW) * (priceHistory.length - 1)))));
            }}
            onMouseLeave={() => setHoveredIdx(null)}
            onTouchMove={(e) => {
              const t = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const lx = ((t.clientX - rect.left) / rect.width) * 400;
              const rx = lx - CL;
              if (rx < 0 || rx > CW) { setHoveredIdx(null); return; }
              setHoveredIdx(Math.max(0, Math.min(priceHistory.length - 1, Math.round((rx / CW) * (priceHistory.length - 1)))));
            }}
            onTouchEnd={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dark ? "#ffffff" : "#000000"} stopOpacity="0.05"/>
                <stop offset="100%" stopColor={dark ? "#ffffff" : "#000000"} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Horizontal grid lines at Y-axis tick positions */}
            {yTicks.map((tick, i) => (
              <line key={i} x1={CL} y1={priceToY(tick)} x2={CR} y2={priceToY(tick)}
                stroke={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} strokeWidth="1" />
            ))}
            {/* Area fill */}
            <path
              d={`M ${CL},${CB} ${priceHistory.map((h, i) => `L ${indexToX(i)},${priceToY(h.price)}`).join(" ")} L ${indexToX(priceHistory.length - 1)},${CB} Z`}
              fill="url(#chartFill)"
            />
            {/* Peg reference line at $1.0000 */}
            {showPeg && (
              <>
                <line x1={CL} y1={pegY} x2={CR} y2={pegY}
                  stroke={dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
                  strokeWidth="1" strokeDasharray="5,4" />
                <text x={CR - 3} y={pegY - 3} textAnchor="end" fontSize="7"
                  fill={dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"}>Peg: $1.0000</text>
              </>
            )}
            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
              <text key={i} x={CL - 5} y={priceToY(tick) + 3} textAnchor="end" fontSize="7"
                fill={dark ? "#6b7280" : "#9ca3af"}>{tick.toFixed(4)}</text>
            ))}
            {/* Y-axis rule */}
            <line x1={CL} y1={CT} x2={CL} y2={CB}
              stroke={dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />
            {/* Coloured line: red <0.9990, amber 0.9990–0.9995, green ≥0.9995 */}
            {priceHistory.slice(0, -1).map((h, i) => (
              <line key={i}
                x1={indexToX(i)} y1={priceToY(h.price)}
                x2={indexToX(i + 1)} y2={priceToY(priceHistory[i + 1].price)}
                stroke={segColor(h.price)} strokeWidth="1.5" strokeLinecap="round" />
            ))}
            {/* Hover tooltip */}
            {hovPoint && (
              <>
                <line x1={hovX} y1={CT} x2={hovX} y2={CB}
                  stroke={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
                  strokeWidth="1" strokeDasharray="3,3" />
                <circle cx={hovX} cy={hovY} r="3" fill={segColor(hovPoint.price)} />
                <rect x={tbx} y={tby} width="84" height="28" rx="4"
                  fill={dark ? "#1e2a40" : "#ffffff"}
                  stroke={dark ? "#374151" : "#e5e7eb"} strokeWidth="0.5" />
                <text x={tbx + 6} y={tby + 11} fontSize="7.5" fontWeight="700"
                  fill={segColor(hovPoint.price)}>${hovPoint.price.toFixed(5)}</text>
                <text x={tbx + 6} y={tby + 21} fontSize="7"
                  fill={dark ? "#6b7280" : "#9ca3af"}>{hovDateStr} {hovTimeStr}</text>
              </>
            )}
          </svg>
        ) : (
          <div style={{ fontSize: "12px", color: textSecondary, textAlign: "center", padding: "20px 0" }}>Collecting price history...</div>
        )}
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Source Consensus</div>
        {Object.keys(sourcePrices).length > 0 ? (
          <>
            {Object.entries(sourcePrices).filter(([, p]) => (p as number) > 0).map(([source, p]) => (
              <div key={source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: textSecondary, textTransform: "capitalize" }}>{source}</span>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: textPrimary }}>${(p as number).toFixed(4)}</span>
              </div>
            ))}
            {Object.values(sourcePrices).filter(p => (p as number) > 0).length > 1 && (
              <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${cardBorder}`, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: textSecondary }}>Consensus (median)</span>
                <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: textPrimary }}>${currentPrice.toFixed(4)}</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: "12px", color: textSecondary }}>Loading sources...</div>
        )}
      </div>

      {uniswapEntry && (
        <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>DEX Divergence</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: textSecondary }}>Uniswap V3 Pool Price</span>
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: textPrimary }}>${uniswapEntry.pool_price.toFixed(5)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: textSecondary }}>Divergence vs Consensus</span>
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: textPrimary }}>{uniswapEntry.divergence_bps} bps</span>
          </div>
          {(() => {
            const bps = uniswapEntry.divergence_bps;
            const d = bps < 5
              ? { text: "Tight",    color: "#22c55e", bg: dark ? "#052e16" : "#f0fdf4", border: dark ? "#166534" : "#bbf7d0" }
              : bps <= 20
              ? { text: "Moderate", color: "#f59e0b", bg: dark ? "#451a03" : "#fffbeb", border: dark ? "#92400e" : "#fde68a" }
              : { text: "Wide",     color: "#ef4444", bg: dark ? "#450a0a" : "#fef2f2", border: dark ? "#991b1b" : "#fecaca" };
            return (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "8px", background: d.bg, border: `1px solid ${d.border}` }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: d.color, display: "inline-block" }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: d.color }}>{d.text}</span>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Collateralisation</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "12px", color: textSecondary }}>Collateral Ratio</span>
          <span style={{ fontSize: "12px", fontWeight: "700", color: textPrimary }}>{coin.collateralRatio}</span>
        </div>
        <div style={{ height: "8px", background: dark ? "#1e2a40" : "#f3f4f6", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
          <div style={{ height: "100%", width: `${Math.min(parseFloat(coin.collateralRatio) || 0, 150) / 150 * 100}%`, background: "linear-gradient(90deg, #1a56db, #10b981)", borderRadius: "4px" }}></div>
        </div>
        <div style={{ fontSize: "12px", color: textSecondary }}>{coin.collateral}</div>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Reserve Transparency</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "12px", color: textSecondary }}>Audit Score</span>
          <span style={{ fontSize: "12px", fontWeight: "700", color: textPrimary }}>{coin.auditScore}/100</span>
        </div>
        <div style={{ height: "8px", background: dark ? "#1e2a40" : "#f3f4f6", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
          <div style={{ height: "100%", width: `${coin.auditScore}%`, background: coin.auditScore >= 80 ? "linear-gradient(90deg, #1a56db, #10b981)" : coin.auditScore >= 60 ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ef4444, #dc2626)", borderRadius: "4px" }}></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: textSecondary }}>Auditor</span>
          <span style={{ fontSize: "12px", color: textPrimary }}>{coin.reserveAudit}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
          <span style={{ fontSize: "12px", color: textSecondary }}>Last Audit</span>
          <span style={{ fontSize: "12px", color: textPrimary }}>{coin.auditDate}</span>
        </div>
      </div>

      {chainlinkPor && (
        <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>Chainlink Verified Reserves</div>
            <a href="https://chain.link" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", background: "#375BD2", color: "#ffffff", fontSize: "11px", fontWeight: "700", textDecoration: "none" }}>
              <span style={{ fontSize: "11px" }}>⬡</span> Chainlink
            </a>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: textSecondary }}>On-chain Reserves</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#10b981" }}>
              ${(chainlinkPor.reserves / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: textSecondary }}>Last Updated</span>
            <span style={{ fontSize: "12px", color: textPrimary }}>{new Date(chainlinkPor.updated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: dark ? "#052e16" : "#f0fdf4", border: `1px solid ${dark ? "#166534" : "#bbf7d0"}` }}>
            <span style={{ fontSize: "14px" }}>✅</span>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>Chainlink Verified</span>
          </div>
        </div>
      )}

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "8px" }}>About {coin.name}</div>
        <p style={{ fontSize: "13px", color: textSecondary, lineHeight: "1.6", margin: 0 }}>{coin.description}</p>
        <div style={{ marginTop: "12px", padding: "10px 12px", background: dark ? "#080e1a" : "#f8f9fb", borderRadius: "8px", border: `1px solid ${headerBorder}` }}>
          <div style={{ fontSize: "10px", color: textSecondary, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Contract Address</div>
          <div style={{ fontFamily: "monospace", fontSize: "11px", color: textPrimary, wordBreak: "break-all" }}>{coin.contractAddress}</div>
        </div>
      </div>

      <div style={{ margin: "16px 20px 0", background: cardBg, borderRadius: "12px", padding: "20px", border: `1px solid ${headerBorder}` }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, marginBottom: "12px" }}>Large Transactions</div>
        <LargeTransactions slug={slug} dark={dark} cardBorder={cardBorder} textSecondary={textSecondary} textPrimary={textPrimary} />
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Privacy Policy</a>
        </div>
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