"use client";
import { usePathname } from "next/navigation";

export default function BottomNav({ dark }: { dark: boolean }) {
  const pathname = usePathname();

  const navBg     = dark ? "#0d1628" : "#ffffff";
  const navBorder = dark ? "#1e2a40" : "#eaecf0";
  const inactive  = dark ? "#6b7280" : "#9ca3af";

  const c = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return active ? "#1a56db" : inactive;
  };

  const tab: React.CSSProperties = {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", gap: "3px",
    textDecoration: "none", padding: "4px 0",
  };
  const label = (href: string): React.CSSProperties => ({
    fontSize: "9px", fontWeight: "600", color: c(href),
  });

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100, transition: "background 0.2s ease" }}>

      {/* Home */}
      <a href="/" style={tab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c("/")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span style={label("/")}>Home</span>
      </a>

      {/* Alerts */}
      <a href="/alerts" style={tab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c("/alerts")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={label("/alerts")}>Alerts</span>
      </a>

      {/* About */}
      <a href="/about" style={tab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c("/about")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={label("/about")}>About</span>
      </a>

      {/* History */}
      <a href="/history" style={tab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c("/history")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={label("/history")}>History</span>
      </a>

      {/* LiquidLens */}
      <a href="/positions" style={tab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c("/positions")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="16.5" y1="16.5" x2="22" y2="22"/>
        </svg>
        <span style={label("/positions")}>LiquidLens</span>
      </a>

    </div>
  );
}
