"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthProvider[];
};

declare global {
  interface Window {
    ethereum?: EthProvider;
    coinbaseWalletExtension?: EthProvider;
  }
}

// Resolve the best available EIP-1193 provider across common wallet types.
// When multiple extensions co-exist they populate window.ethereum.providers (EIP-5749).
function resolveProvider(): EthProvider | null {
  const eth = window.ethereum;
  if (eth?.providers?.length) {
    // Prefer the first non-MetaMask entry so Coinbase / Trust users aren't forced
    // through MetaMask, then fall back to MetaMask, then whatever is first.
    return (
      eth.providers.find((p) => p.isCoinbaseWallet) ??
      eth.providers.find((p) => p.isTrust || p.isTrustWallet) ??
      eth.providers.find((p) => p.isMetaMask) ??
      eth.providers[0]
    );
  }
  if (eth) return eth;
  // Coinbase Wallet SDK can inject on its own key when window.ethereum is absent
  return window.coinbaseWalletExtension ?? null;
}

function getWalletName(provider: EthProvider): string {
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isTrust || provider.isTrustWallet) return "Trust Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return "Wallet";
}

function formatBalance(balance: string, decimals: number): number {
  const n = BigInt(balance);
  const divisor = BigInt(10) ** BigInt(decimals);
  return Number(n / divisor) + Number(n % divisor) / Number(divisor);
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const stablecoins = [
    { name: "USDT",   issuer: "Tether",         peg: 1.0,   icon: "/icons/usdt.png",   slug: "usdt",   bgColor: "#26a17b" },
    { name: "USDC",   issuer: "Circle",          peg: 1.0,   icon: "/icons/usdc.png",   slug: "usdc",   bgColor: "#2775ca" },
    { name: "USDS",   issuer: "MakerDAO",        peg: 0.999, icon: "/icons/usds.png",   slug: "usds",   bgColor: "#f4b731" },
    { name: "Ethena", issuer: "Ethena Labs",     peg: 1.0,   icon: "/icons/ethena.png", slug: "ethena", bgColor: "#1a1a2e" },
    { name: "PYUSD",  issuer: "PayPal",          peg: 1.0,   icon: "/icons/pyusd.png",  slug: "pyusd",  bgColor: "#003087" },
    { name: "FDUSD",  issuer: "First Digital",   peg: 1.0,   icon: "/icons/fdusd.png",  slug: "fdusd",  bgColor: "#1a1a1a" },
    { name: "RLUSD",  issuer: "Ripple",          peg: 1.0,   icon: "/icons/rlusd.png",  slug: "rlusd",  bgColor: "#346aa9" },
    { name: "TUSD",   issuer: "TrueUSD",         peg: 0.997, icon: "/icons/tusd.png",   slug: "tusd",   bgColor: "#1a3a5c" },
    { name: "FRAX",   issuer: "Frax Finance",    peg: 1.0,   icon: "/icons/frax.png",   slug: "frax",   bgColor: "#1c1c1c" },
    { name: "GHO",    issuer: "Aave",            peg: 1.0,   icon: "/icons/gho.png",    slug: "gho",    bgColor: "#b6509e" },
    { name: "crvUSD", issuer: "Curve Finance",   peg: 1.0,   icon: "/icons/crvusd.png", slug: "crvusd", bgColor: "#3a3a3a" },
    { name: "LUSD",   issuer: "Liquity",         peg: 1.0,   icon: "/icons/lusd.png",   slug: "lusd",   bgColor: "#2eb6ae" },
    { name: "USDP",   issuer: "Paxos",           peg: 1.0,   icon: "/icons/usdp.png",   slug: "usdp",   bgColor: "#00735b" },
    { name: "USDD",   issuer: "TRON DAO",        peg: 1.0,   icon: "/icons/usdd.png",   slug: "usdd",   bgColor: "#eb0029" },
    { name: "mkUSD",  issuer: "Prisma Finance",  peg: 1.0,   icon: "/icons/mkusd.png",  slug: "mkusd",  bgColor: "#6b21a8" },
    { name: "EURC",   issuer: "Circle",          peg: 1.13,  icon: "/icons/eurc.png",   slug: "eurc",   bgColor: "#2563eb" },
    { name: "DOLA",   issuer: "Inverse Finance", peg: 1.0,   icon: "/icons/dola.png",   slug: "dola",   bgColor: "#1e3a5f" },
    { name: "alUSD",  issuer: "Alchemix",        peg: 1.0,   icon: "/icons/alusd.png",  slug: "alusd",  bgColor: "#f59e0b" },
    { name: "BOLD",   issuer: "Liquity V2",      peg: 1.0,   icon: "/icons/bold.svg",   slug: "bold",   bgColor: "#0f766e" },
  ];

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [eurUsd, setEurUsd] = useState(1.13);
  const [lastUpdated, setLastUpdated] = useState<string>("Loading...");
  const [hoveredCoin, setHoveredCoin] = useState<string | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pegcheck-dark") === "true";
    }
    return false;
  });

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string>("");
  const [walletBalances, setWalletBalances] = useState<Record<string, { balance: string; decimals: number }>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const pathname = usePathname();

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("pegcheck-dark", String(next));
  };

  const fetchBalances = useCallback(async (address: string) => {
    setBalancesLoading(true);
    try {
      const res = await fetch(`/api/balances?address=${address}`);
      const data = await res.json();
      if (data.balances) setWalletBalances(data.balances);
    } catch {
      // silently fail — holdings section simply won't show
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const connectWallet = async () => {
    const provider = resolveProvider();
    if (!provider) {
      setConnectError("No Ethereum wallet detected. Install MetaMask, Coinbase Wallet, or Trust Wallet.");
      return;
    }
    setIsConnecting(true);
    setConnectError(null);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts[0]) {
        const addr = accounts[0].toLowerCase();
        const name = getWalletName(provider);
        setWalletAddress(addr);
        setWalletName(name);
        localStorage.setItem("pegcheck-wallet", addr);
        localStorage.setItem("pegcheck-wallet-name", name);
        fetchBalances(addr);
      }
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        setConnectError("Connection rejected. Approve the request in your wallet.");
      } else if (code === -32002) {
        setConnectError("A connection request is already pending — check your wallet.");
      } else {
        setConnectError("Failed to connect. Make sure your wallet is unlocked and try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setWalletName("");
    setWalletBalances({});
    setConnectError(null);
    localStorage.removeItem("pegcheck-wallet");
    localStorage.removeItem("pegcheck-wallet-name");
  };

  // Check for any injected wallet and restore saved session on mount
  useEffect(() => {
    setHasWallet(!!resolveProvider());
    const saved = localStorage.getItem("pegcheck-wallet");
    const savedName = localStorage.getItem("pegcheck-wallet-name");
    if (saved) {
      setWalletAddress(saved);
      if (savedName) setWalletName(savedName);
      fetchBalances(saved);
    }
  }, [fetchBalances]);

  // Listen for account changes on the active provider
  useEffect(() => {
    const provider = resolveProvider();
    if (!provider?.on) return;
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        disconnectWallet();
      } else {
        const addr = list[0].toLowerCase();
        setWalletAddress(addr);
        localStorage.setItem("pegcheck-wallet", addr);
        fetchBalances(addr);
      }
    };
    provider.on("accountsChanged", handler);
  }, [fetchBalances]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        if (data.prices) {
          setPrices(data.prices);
          if (data.eurUsd) setEurUsd(data.eurUsd);
          const now = new Date();
          setLastUpdated(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        }
      } catch (error) {
        console.error("Failed to fetch prices", error);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowInstallBanner(false);
      setDeferredPrompt(null);
    } else {
      alert("To add to home screen: tap the Share button then 'Add to Home Screen'");
    }
  };

  const getLivePrice = (slug: string, fallback: number) => prices[slug] ?? fallback;
  const getEffectivePeg = (slug: string) => slug === "eurc" ? eurUsd : (COIN_PEGS[slug] ?? 1.0);

  const getStatus = (price: number, peg: number, slug = '') => {
    const { healthy, caution } = getThresholds(slug);
    const diff = Math.abs(price - peg) / peg;
    if (diff <= healthy) return "Healthy";
    if (diff <= caution) return "Caution";
    return "Depeg";
  };

  const statusColor = (status: string) => {
    if (status === "Healthy") return "#16a34a";
    if (status === "Caution") return "#d97706";
    return "#dc2626";
  };

  const statusBg = (status: string) => {
    if (dark) {
      if (status === "Healthy") return "#052e16";
      if (status === "Caution") return "#451a03";
      return "#450a0a";
    }
    if (status === "Healthy") return "#f0fdf4";
    if (status === "Caution") return "#fffbeb";
    return "#fef2f2";
  };

  const healthyCount = stablecoins.filter((c) => getStatus(getLivePrice(c.slug, c.peg), getEffectivePeg(c.slug), c.slug) === "Healthy").length;
  const cautionCount = stablecoins.filter((c) => getStatus(getLivePrice(c.slug, c.peg), getEffectivePeg(c.slug), c.slug) === "Caution").length;
  const warningCount = stablecoins.filter((c) => getStatus(getLivePrice(c.slug, c.peg), getEffectivePeg(c.slug), c.slug) === "Depeg").length;

  const holdings = walletAddress
    ? stablecoins.filter((coin) => {
        const bal = walletBalances[coin.slug];
        if (!bal || bal.balance === "0") return false;
        return formatBalance(bal.balance, bal.decimals) > 0.0001;
      })
    : [];

  const portfolioTotal = holdings.reduce((sum, coin) => {
    const bal = walletBalances[coin.slug];
    const amount = formatBalance(bal.balance, bal.decimals);
    return sum + amount * getLivePrice(coin.slug, coin.peg);
  }, 0);

  const portfolioRiskScore = (() => {
    if (holdings.length === 0 || portfolioTotal === 0) return 0;
    const weighted = holdings.reduce((sum, coin) => {
      const bal = walletBalances[coin.slug];
      const amount = formatBalance(bal.balance, bal.decimals);
      const price = getLivePrice(coin.slug, coin.peg);
      const weight = (amount * price) / portfolioTotal;
      const status = getStatus(price, getEffectivePeg(coin.slug), coin.slug);
      const pts = status === "Depeg" ? 10 : status === "Caution" ? 5 : 1;
      return sum + weight * pts;
    }, 0);
    return Math.round(weighted * 10) / 10;
  })();

  const riskColor = portfolioRiskScore <= 3 ? "#16a34a" : portfolioRiskScore <= 6 ? "#d97706" : "#dc2626";
  const riskLabel = portfolioRiskScore <= 3 ? "Low Risk" : portfolioRiskScore <= 6 ? "Moderate Risk" : "High Risk";
  const riskBg = dark
    ? (portfolioRiskScore <= 3 ? "#052e16" : portfolioRiskScore <= 6 ? "#451a03" : "#450a0a")
    : (portfolioRiskScore <= 3 ? "#f0fdf4" : portfolioRiskScore <= 6 ? "#fffbeb" : "#fef2f2");

  const bg = dark ? "#0a0e1a" : "#f8f9fb";
  const headerBg = dark ? "#0d1628" : "#ffffff";
  const headerBorder = dark ? "#1e2a40" : "#eaecf0";
  const cardBg = dark ? "#0d1628" : "#ffffff";
  const cardBorder = dark ? "#1e2a40" : "#f3f4f6";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textSecondary = dark ? "#6b7280" : "#9ca3af";
  const rowHover = dark ? "#111f38" : "#f9fafb";
  const tableHeaderBg = dark ? "#080e1a" : "#f8f9fb";
  const navBg = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";
  const dotBorder = dark ? "#0d1628" : "#ffffff";

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "70px", transition: "background 0.2s ease" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: "16px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", transition: "background 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={{ width: "38px", height: "38px", flexShrink: 0, background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "15px" }}>P✓</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: textPrimary, lineHeight: "1.2" }}>PegCheck</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "3px" }}>Prices from 6 independent sources</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "11px", color: textSecondary, fontFamily: "monospace" }}>Updated {lastUpdated}</div>
          <button onClick={toggleDark} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: dark ? "#1e2a40" : "#f3f4f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 20px", background: headerBg, borderBottom: `1px solid ${headerBorder}`, flexWrap: "wrap" }}>
        {healthyCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#052e16" : "#f0fdf4" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#16a34a" }}>{healthyCount} Healthy</span>
          </div>
        )}
        {cautionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#451a03" : "#fffbeb" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#d97706" }}>{cautionCount} Caution</span>
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: dark ? "#450a0a" : "#fef2f2" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }}></div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#dc2626" }}>{warningCount} Depeg</span>
          </div>
        )}
      </div>

      {/* Table header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "8px 20px", background: tableHeaderBg, borderBottom: `1px solid ${headerBorder}` }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Coin</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Peg</span>
        <span style={{ fontSize: "11px", fontWeight: "600", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Status</span>
      </div>

      {/* Coin list */}
      <div style={{ background: cardBg, transition: "background 0.2s ease" }}>
        {stablecoins.map((coin) => {
          const livePrice = getLivePrice(coin.slug, coin.peg);
          const liveStatus = getStatus(livePrice, getEffectivePeg(coin.slug), coin.slug);
          return (
            <Link
              key={coin.name}
              href={`/coin/${coin.slug}`}
              onMouseEnter={() => setHoveredCoin(coin.slug)}
              onMouseLeave={() => setHoveredCoin(null)}
              style={{
                textDecoration: "none",
                display: "grid",
                gridTemplateColumns: "1fr 80px 100px",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: `1px solid ${cardBorder}`,
                background: hoveredCoin === coin.slug ? rowHover : cardBg,
                transition: "background 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={coin.icon} alt={coin.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                  </div>
                  <div style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "11px", height: "11px", borderRadius: "50%", background: statusColor(liveStatus), border: `2px solid ${dotBorder}` }}></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: textPrimary }}>{coin.name}</span>
                  <span style={{ fontSize: "11px", color: textSecondary }}>{coin.issuer}</span>
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "500", color: livePrice < 0.995 ? statusColor(liveStatus) : (dark ? "#d1d5db" : "#374151"), textAlign: "center" }}>
                ${livePrice.toFixed(4)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", background: statusBg(liveStatus), color: statusColor(liveStatus), whiteSpace: "nowrap" }}>
                  {liveStatus}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", color: textSecondary }}>Tap any coin for full reserve details →</span>
      </div>

      {/* Wallet card */}
      {walletAddress ? (
        <div style={{ margin: "0 20px 4px", background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, overflow: "hidden" }}>
          {/* Card header: title + total value left, wallet indicator right */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${cardBorder}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>Your Holdings</div>
              {portfolioTotal > 0 && (
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "monospace", color: textPrimary, marginTop: "3px", lineHeight: 1 }}>
                  ${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              {balancesLoading && <span style={{ fontSize: "11px", color: textSecondary }}>Loading...</span>}
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  {walletName && <span style={{ fontSize: "10px", fontWeight: "600", color: textSecondary, lineHeight: 1.2 }}>{walletName}</span>}
                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: textSecondary }}>{truncateAddress(walletAddress)}</span>
                </div>
              </div>
              <button onClick={disconnectWallet} style={{ fontSize: "11px", color: textSecondary, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Disconnect</button>
            </div>
          </div>

          {/* Risk score panel */}
          {!balancesLoading && holdings.length > 0 && portfolioTotal > 0 && (
            <div style={{ padding: "16px", borderBottom: `1px solid ${cardBorder}`, display: "flex", alignItems: "center", gap: "16px", background: riskBg }}>
              <div style={{ flexShrink: 0, textAlign: "center", minWidth: "56px" }}>
                <div style={{ fontSize: "40px", fontWeight: "800", lineHeight: 1, color: riskColor, fontFamily: "monospace" }}>
                  {portfolioRiskScore.toFixed(1)}
                </div>
                <div style={{ fontSize: "10px", color: riskColor, opacity: 0.7, marginTop: "2px" }}>/ 10</div>
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: riskColor, marginBottom: "3px" }}>{riskLabel}</div>
                <div style={{ fontSize: "12px", color: riskColor, opacity: 0.75, lineHeight: "1.4" }}>Based on your current stablecoin holdings</div>
              </div>
            </div>
          )}

          {/* Holdings rows */}
          {!balancesLoading && holdings.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: "12px", color: textSecondary }}>
              No tracked stablecoin holdings found on this wallet
            </div>
          ) : (
            holdings.map((coin) => {
              const bal = walletBalances[coin.slug];
              const amount = formatBalance(bal.balance, bal.decimals);
              const price = getLivePrice(coin.slug, coin.peg);
              const usdValue = amount * price;
              const status = getStatus(price, getEffectivePeg(coin.slug), coin.slug);
              return (
                <Link
                  key={coin.slug}
                  href={`/coin/${coin.slug}`}
                  style={{ textDecoration: "none", display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: "10px", padding: "11px 16px", borderBottom: `1px solid ${cardBorder}`, background: cardBg }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      <img src={coin.icon} alt={coin.name} style={{ width: "20px", height: "20px", objectFit: "contain" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.name}</div>
                      <div style={{ fontSize: "11px", color: textSecondary, fontFamily: "monospace" }}>
                        {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "13px", color: textPrimary, textAlign: "right" }}>
                    ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "600", background: statusBg(status), color: statusColor(status), whiteSpace: "nowrap" }}>
                    {status}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ margin: "0 20px 4px", background: cardBg, borderRadius: "12px", border: `1px solid ${cardBorder}`, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "14px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: dark ? "#1e2a40" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6b7280" : "#9ca3af"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>
              <path d="M20 12h-5a2 2 0 1 0 0 4h5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: textPrimary, marginBottom: "5px" }}>Connect Your Wallet</div>
            <div style={{ fontSize: "13px", color: textSecondary, lineHeight: "1.5", maxWidth: "280px" }}>See your stablecoin holdings and personalised risk exposure</div>
          </div>
          {connectError && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: dark ? "#450a0a" : "#fef2f2", border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`, fontSize: "12px", color: "#dc2626", maxWidth: "300px", lineHeight: "1.5" }}>
              {connectError}
            </div>
          )}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            style={{ padding: "11px 28px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", color: "white", fontSize: "14px", fontWeight: "700", cursor: isConnecting ? "wait" : "pointer", opacity: isConnecting ? 0.7 : 1 }}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {!hasWallet && (
            <div style={{ fontSize: "11px", color: textSecondary }}>No wallet detected — install MetaMask, Coinbase Wallet, or Trust Wallet</div>
          )}
        </div>
      )}

      <div style={{ padding: "12px 20px 4px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: dark ? "#4b5563" : "#9ca3af", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>Privacy Policy</a>
          <a href="/onchain" style={{ fontSize: "12px", fontWeight: "600", color: dark ? "#6b7280" : "#4b5563", textDecoration: "none" }}>⛓ On-Chain Record</a>
        </div>
      </div>

      {showInstallBanner && (
        <div style={{ position: "fixed", bottom: "70px", left: "16px", right: "16px", background: dark ? "#0d1628" : "#ffffff", border: `1px solid ${headerBorder}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 99, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "13px", flexShrink: 0 }}>P✓</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>Add to home screen</div>
              <div style={{ fontSize: "11px", color: textSecondary }}>Get instant depeg alerts</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={installApp} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Add</button>
            <button onClick={() => setShowInstallBanner(false)} style={{ padding: "6px 10px", borderRadius: "8px", border: `1px solid ${headerBorder}`, background: "transparent", color: textSecondary, fontSize: "12px", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: pathname === "/" ? "#1a56db" : textSecondary }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/alerts" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: pathname === "/alerts" ? "#1a56db" : textSecondary }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/about" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: pathname === "/about" ? "#1a56db" : textSecondary }}>About</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/history" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: pathname === "/history" ? "#1a56db" : textSecondary }}>History</span>
        </a>
        <a href="/stableguard" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pathname === "/stableguard" ? "#1a56db" : textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize: "9px", fontWeight: "600", color: pathname === "/stableguard" ? "#1a56db" : textSecondary }}>Guard</span>
        </a>
      </div>

    </main>
  );
}
