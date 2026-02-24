import Link from "next/link";

const coinData: Record<string, {
  name: string;
  issuer: string;
  peg: number;
  status: string;
  collateral: string;
  icon: string;
  description: string;
  dataSource: string;
}> = {
  usdt: {
    name: "USDT",
    issuer: "Tether",
    peg: 1.0,
    status: "Healthy",
    collateral: "Cash & Treasuries",
    icon: "/icons/usdt.png",
    description: "Tether is the largest stablecoin by market cap. Each USDT token is backed by US dollars and treasury bills held in reserve by Tether Limited.",
    dataSource: "Issuer reported — Tether quarterly attestation",
  },
  usdc: {
    name: "USDC",
    issuer: "Circle",
    peg: 1.0,
    status: "Healthy",
    collateral: "Cash & Treasuries",
    icon: "/icons/usdc.png",
    description: "USD Coin is issued by Circle and is one of the most regulated stablecoins available. Reserves are held in cash and short-dated US Treasury bills.",
    dataSource: "Monthly attestation by Deloitte",
  },
  usds: {
    name: "USDS",
    issuer: "MakerDAO",
    peg: 0.999,
    status: "Slight Depeg",
    collateral: "Overcollateralised Crypto",
    icon: "/icons/usds.png",
    description: "USDS is backed by crypto assets worth more than the tokens in circulation. This overcollateralisation provides a buffer against price drops in the underlying assets.",
    dataSource: "On-chain — MakerDAO smart contracts",
  },
  ethena: {
    name: "Ethena",
    issuer: "Ethena Labs",
    peg: 1.0,
    status: "Healthy",
    collateral: "Delta-neutral strategy",
    icon: "/icons/ethena.png",
    description: "Ethena maintains its peg through a delta-neutral trading strategy using crypto derivatives rather than holding traditional cash reserves.",
    dataSource: "On-chain — Ethena protocol",
  },
  pyusd: {
    name: "PYUSD",
    issuer: "PayPal",
    peg: 1.0,
    status: "Healthy",
    collateral: "Cash & equivalents",
    icon: "/icons/pyusd.png",
    description: "PayPal USD is issued by Paxos Trust Company on behalf of PayPal. It is backed by US dollar deposits and treasury bills.",
    dataSource: "Monthly attestation by Withum",
  },
  fdusd: {
    name: "FDUSD",
    issuer: "First Digital",
    peg: 1.0,
    status: "Healthy",
    collateral: "Cash reserves",
    icon: "/icons/fdusd.png",
    description: "First Digital USD is backed by cash held in regulated financial institutions. It is primarily used on Binance and other Asian exchanges.",
    dataSource: "Issuer reported — First Digital Trust",
  },
  rlusd: {
    name: "RLUSD",
    issuer: "Ripple",
    peg: 1.0,
    status: "Healthy",
    collateral: "Cash & Treasuries",
    icon: "/icons/rlusd.png",
    description: "Ripple USD is issued by Ripple and backed by US dollar deposits and government treasuries. It operates on both the XRP Ledger and Ethereum.",
    dataSource: "Issuer reported — Ripple",
  },
  tusd: {
    name: "TUSD",
    issuer: "TrueUSD",
    peg: 0.997,
    status: "Warning",
    collateral: "Attested reserves",
    icon: "/icons/tusd.png",
    description: "TrueUSD uses real-time attestations to verify its reserves. It has experienced periods of instability and currently shows a deviation from its $1.00 peg.",
    dataSource: "Real-time attestation by Chainlink",
  },
};

const statusColor = (status: string) => {
  if (status === "Healthy") return "#16a34a";
  if (status === "Slight Depeg") return "#d97706";
  if (status === "Warning") return "#ea580c";
  return "#dc2626";
};

const statusBg = (status: string) => {
  if (status === "Healthy") return "#f0fdf4";
  if (status === "Slight Depeg") return "#fffbeb";
  if (status === "Warning") return "#fff7ed";
  return "#fef2f2";
};

export default async function CoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coin = coinData[slug.toLowerCase()];

  if (!coin) {
    return (
      <main style={{ padding: "40px 20px", textAlign: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <p style={{ color: "#9ca3af" }}>Coin not found.</p>
        <Link href="/" style={{ color: "#1a56db", fontSize: "14px" }}>← Back to PegCheck</Link>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f8f9fb", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#ffffff", padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/" style={{ fontSize: "20px", textDecoration: "none" }}>←</Link>
        <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
        <span style={{ fontSize: "16px", fontWeight: "700", color: "#111827" }}>PegCheck</span>
      </div>

      {/* Coin Hero */}
      <div style={{ background: "#ffffff", padding: "24px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ position: "relative" }}>
          <img src={coin.icon} alt={coin.name} width={56} height={56} style={{ borderRadius: "50%", display: "block" }} />
          <div style={{ position: "absolute", bottom: "0", right: "0", width: "14px", height: "14px", borderRadius: "50%", background: statusColor(coin.status), border: "2px solid #ffffff" }}></div>
        </div>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#111827" }}>{coin.name}</div>
          <div style={{ fontSize: "13px", color: "#9ca3af" }}>{coin.issuer}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", background: statusBg(coin.status), color: statusColor(coin.status) }}>
            {coin.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#eaecf0", margin: "16px 20px", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ background: "#ffffff", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Peg Price</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: coin.peg < 0.995 ? statusColor(coin.status) : "#111827", fontFamily: "monospace" }}>${coin.peg.toFixed(3)}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Collateral</div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{coin.collateral}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ background: "#ffffff", margin: "0 20px 16px", borderRadius: "12px", padding: "16px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>About</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>{coin.description}</p>
      </div>

      {/* Data Source */}
      <div style={{ background: "#ffffff", margin: "0 20px 16px", borderRadius: "12px", padding: "16px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Data Source</div>
        <p style={{ fontSize: "13px", color: "#374151", margin: 0 }}>📊 {coin.dataSource}</p>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: "#d1d5db", fontFamily: "monospace" }}>PegCheck v0.2 — mock data only · Not financial advice</span>
      </div>

    </main>
  );
}