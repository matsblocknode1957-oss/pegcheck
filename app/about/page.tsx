export default function AboutPage() {
  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f8f9fb", minHeight: "100vh", paddingBottom: "70px" }}>

      <div style={{ background: "#ffffff", padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "34px", height: "34px", background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "14px" }}>P✓</div>
        <span style={{ fontSize: "16px", fontWeight: "700", color: "#111827" }}>About</span>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>What is PegCheck?</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck is a free, real-time stablecoin health monitor. It tracks the peg price of the most widely used stablecoins and flags any deviation the moment it happens.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>Why we built it</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>In 2022 TerraUSD collapsed almost overnight, wiping out billions in savings. Most people using stablecoins had no idea it was happening until it was too late. PegCheck exists so that never happens to you without warning.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>Who is it for?</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>Anyone holding or using stablecoins. You don't need to be a trader or a crypto expert. If you have money in USDT, USDC or any other stablecoin, you deserve to know if something is wrong.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>How it works</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck pulls live price data every 60 seconds and automatically flags any coin that strays from its $1.00 peg. Green means healthy. Amber means watch closely. Red means something needs your attention.</p>
      </div>

      <div style={{ margin: "16px 20px 0", background: "#ffffff", borderRadius: "12px", padding: "20px", border: "1px solid #eaecf0" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>The small print</div>
        <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: 0 }}>PegCheck displays information only. Nothing on this site is financial advice. Always do your own research before making any financial decisions.</p>
      </div>

      <div style={{ padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "10px", color: "#d1d5db", fontFamily: "monospace" }}>PegCheck v0.6 — Not financial advice</span>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #eaecf0", display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>🏠</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>🔔</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#9ca3af" }}>Alerts</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <span style={{ fontSize: "20px" }}>ℹ️</span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>About</span>
        </a>
      </div>

    </main>
  );
}