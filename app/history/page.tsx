import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import HistoryChart from "./HistoryChart";
import { COIN_PEGS, getThresholds } from "@/lib/coinPegs";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Depeg History | PegCheck",
  description: "Historical stablecoin depeg events and all-time low prices for USDT, USDC, USDS, TUSD, PYUSD, FDUSD, RLUSD and Ethena.",
};

const COINS = [
  { slug: "usdt",   name: "USDT",   icon: "/icons/usdt.png",   bgColor: "#26a17b" },
  { slug: "usdc",   name: "USDC",   icon: "/icons/usdc.png",   bgColor: "#2775ca" },
  { slug: "usds",   name: "USDS",   icon: "/icons/usds.png",   bgColor: "#f4b731" },
  { slug: "tusd",   name: "TUSD",   icon: "/icons/tusd.png",   bgColor: "#1a3a5c" },
  { slug: "pyusd",  name: "PYUSD",  icon: "/icons/pyusd.png",  bgColor: "#003087" },
  { slug: "fdusd",  name: "FDUSD",  icon: "/icons/fdusd.png",  bgColor: "#1a1a1a" },
  { slug: "rlusd",  name: "RLUSD",  icon: "/icons/rlusd.png",  bgColor: "#346aa9" },
  { slug: "ethena", name: "Ethena", icon: "/icons/ethena.png", bgColor: "#1a1a2e" },
  { slug: "frax",   name: "FRAX",   icon: "/icons/frax.png",   bgColor: "#1c1c1c" },
  { slug: "gho",    name: "GHO",    icon: "/icons/gho.png",    bgColor: "#b6509e" },
  { slug: "crvusd", name: "crvUSD", icon: "/icons/crvusd.png", bgColor: "#3a3a3a" },
  { slug: "lusd",   name: "LUSD",   icon: "/icons/lusd.png",   bgColor: "#2eb6ae" },
  { slug: "usdp",   name: "USDP",   icon: "/icons/usdp.png",   bgColor: "#00735b" },
  { slug: "usdd",   name: "USDD",   icon: "/icons/usdd.png",   bgColor: "#eb0029" },
  { slug: "mkusd",  name: "mkUSD",  icon: "/icons/mkusd.png",  bgColor: "#6b21a8" },
  { slug: "eurc",   name: "EURC",   icon: "/icons/eurc.png",   bgColor: "#2563eb" },
  { slug: "dola",   name: "DOLA",   icon: "/icons/dola.png",   bgColor: "#1e3a5f" },
  { slug: "alusd",  name: "alUSD",  icon: "/icons/alusd.png",  bgColor: "#f59e0b" },
  { slug: "bold",   name: "BOLD",   icon: "/icons/bold.svg",   bgColor: "#0f766e" },
] as const;

type CoinSlug = typeof COINS[number]["slug"];

interface SummaryItem {
  slug: CoinSlug;
  name: string;
  icon: string;
  bgColor: string;
  atl: number;
  atlDate: string | null;
}

interface DepegEvent {
  slug: string;
  coinName: string;
  startDate: string;
  durationHours: number;
  lowestPrice: number;
  recovered: boolean;
}

function atlBadge(atl: number, peg: number, slug: string): { color: string; bg: string; label: string } {
  const { healthy, caution } = getThresholds(slug);
  const diff = Math.abs(atl - peg) / peg;
  if (diff <= healthy) return { color: "#16a34a", bg: "#052e16", label: "Stable" };
  if (diff <= caution) return { color: "#d97706", bg: "#451a03", label: "Caution" };
  return { color: "#dc2626", bg: "#450a0a", label: "Depeg" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(hours: number): string {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function groupDepegEvents(
  records: { slug: string; price: number; created_at: string }[]
): DepegEvent[] {
  if (!records.length) return [];

  const now = Date.now();
  const bySlug = new Map<string, { slug: string; price: number; created_at: string }[]>();
  for (const r of records) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
    bySlug.get(r.slug)!.push(r);
  }

  const events: DepegEvent[] = [];

  for (const [slug, rows] of bySlug) {
    const sorted = rows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const coinName = COINS.find((c) => c.slug === slug)?.name ?? slug.toUpperCase();

    let groupRecords = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const gapHours =
        (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) /
        3_600_000;

      if (gapHours > 6) {
        events.push(buildEvent(slug, coinName, groupRecords, now));
        groupRecords = [sorted[i]];
      } else {
        groupRecords.push(sorted[i]);
      }
    }
    events.push(buildEvent(slug, coinName, groupRecords, now));
  }

  return events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

function buildEvent(
  slug: string,
  coinName: string,
  records: { price: number; created_at: string }[],
  now: number
): DepegEvent {
  const lowestPrice = Math.min(...records.map((r) => r.price));
  const startDate = records[0].created_at;
  const endDate = records[records.length - 1].created_at;
  const durationHours =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 3_600_000;
  const recovered = now - new Date(endDate).getTime() > 6 * 3_600_000;
  return { slug, coinName, startDate, durationHours, lowestPrice, recovered };
}

export default async function HistoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [summaryResults, usdDepegResult, eurcDepegResult] = await Promise.all([
    Promise.all(
      COINS.map(async (coin) => {
        const { data } = await supabase
          .from("price_history")
          .select("price, created_at")
          .eq("slug", coin.slug)
          .order("price", { ascending: true })
          .limit(1);
        return {
          slug: coin.slug,
          name: coin.name,
          icon: coin.icon,
          bgColor: coin.bgColor,
          atl: data?.[0]?.price ?? (COIN_PEGS[coin.slug] ?? 1.0),
          atlDate: data?.[0]?.created_at ?? null,
        } as SummaryItem;
      })
    ),
    supabase
      .from("price_history")
      .select("slug, price, created_at")
      .neq("slug", "eurc")
      .lt("price", 0.999)
      .order("created_at", { ascending: true }),
    supabase
      .from("price_history")
      .select("slug, price, created_at")
      .eq("slug", "eurc")
      .lt("price", 1.1287)
      .order("created_at", { ascending: true }),
  ]);

  const allDepegRows = [
    ...(usdDepegResult.data ?? []),
    ...(eurcDepegResult.data ?? []),
  ];
  const depegEvents = groupDepegEvents(allDepegRows);

  const bg = "#0a0e1a";
  const headerBg = "#0d1628";
  const headerBorder = "#1e2a40";
  const cardBg = "#0d1628";
  const cardBorder = "#1e2a40";
  const textPrimary = "#f9fafb";
  const textSecondary = "#6b7280";
  const tableHeaderBg = "#080e1a";
  const navBg = "#0d1628";
  const navBorder = "#1e2a40";

  const hallOfFame = [...summaryResults].sort((a, b) => a.atl - b.atl);

  return (
    <main style={{ fontFamily: "'Segoe UI', sans-serif", background: bg, minHeight: "100vh", paddingBottom: "80px" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: "16px 20px", borderBottom: `1px solid ${headerBorder}`, display: "flex", alignItems: "center" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
          <div style={{ width: "38px", height: "38px", flexShrink: 0, background: "linear-gradient(135deg, #1a56db, #0e3fa8)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", fontSize: "15px" }}>P✓</div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: textPrimary, lineHeight: "1.2" }}>PegCheck</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "2px" }}>Depeg History</div>
          </div>
        </a>
      </div>

      {/* ── Section 0: Hall of Fame ── */}
      <div style={{ padding: "20px 20px 12px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>All-Time Lows Hall of Fame</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Every coin ranked by lowest price ever recorded, worst first.</div>
      </div>

      <div style={{ background: tableHeaderBg, borderTop: `1px solid ${headerBorder}`, borderBottom: `1px solid ${headerBorder}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 88px 80px 72px", padding: "8px 20px", columnGap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>#</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Coin</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>ATL Price</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</span>
          <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>vs Peg</span>
        </div>
      </div>

      {hallOfFame.map((coin, i) => {
        const peg = COIN_PEGS[coin.slug] ?? 1.0;
        const pctFromPeg = ((peg - coin.atl) / peg) * 100;
        const { healthy, caution } = getThresholds(coin.slug);
        const absDiff = Math.abs(coin.atl - peg) / peg;
        const rowColor = absDiff > caution ? "#dc2626" : absDiff > healthy ? "#d97706" : "#16a34a";
        const rankColors = ["#f59e0b", "#9ca3af", "#b45309"];
        const rankColor = i < 3 ? rankColors[i] : textSecondary;
        return (
          <div
            key={coin.slug}
            style={{ display: "grid", gridTemplateColumns: "28px 1fr 88px 80px 72px", padding: "11px 20px", borderBottom: `1px solid ${cardBorder}`, background: cardBg, alignItems: "center", columnGap: "8px" }}
          >
            <span style={{ fontSize: "12px", fontWeight: "700", color: rankColor, fontFamily: "monospace" }}>{i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                <img src={coin.icon} alt={coin.name} width={14} height={14} style={{ objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coin.name}</span>
            </div>
            <span style={{ fontSize: "13px", fontFamily: "monospace", fontWeight: "700", color: rowColor }}>${coin.atl.toFixed(4)}</span>
            <span style={{ fontSize: "11px", color: textSecondary }}>{coin.atlDate ? formatDate(coin.atlDate) : "—"}</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "600", color: rowColor }}>
              {pctFromPeg > 0 ? `-${pctFromPeg.toFixed(2)}%` : pctFromPeg < -0.001 ? `+${Math.abs(pctFromPeg).toFixed(2)}%` : "0.00%"}
            </span>
          </div>
        );
      })}

      <div style={{ height: "1px", background: headerBorder, margin: "0 0 0 0" }} />

      {/* ── Section 1: All-Time Lows ── */}
      <div style={{ padding: "20px 20px 12px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>All-Time Lows</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "0 20px 24px" }}>
        {summaryResults.map((coin) => {
          const badge = atlBadge(coin.atl, COIN_PEGS[coin.slug] ?? 1.0, coin.slug);
          return (
            <div
              key={coin.slug}
              style={{ flex: "1 1 140px", background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: coin.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <img src={coin.icon} alt={coin.name} width={18} height={18} style={{ objectFit: "contain" }} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{coin.name}</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "700", color: badge.color }}>
                ${coin.atl.toFixed(4)}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: textSecondary }}>{coin.atlDate ? formatDate(coin.atlDate) : "—"}</span>
                <span style={{ padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: "1px", background: headerBorder, margin: "0 20px" }} />

      {/* ── Section 2: Price History Chart ── */}
      <div style={{ padding: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "14px" }}>Price History</div>
        <HistoryChart coins={COINS.map((c) => ({ slug: c.slug, name: c.name }))} />
      </div>

      <div style={{ height: "1px", background: headerBorder, margin: "0 20px" }} />

      {/* ── Section 3: Depeg Events ── */}
      <div style={{ padding: "20px 20px 8px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>Depeg Events</div>
        <div style={{ fontSize: "12px", color: textSecondary, marginBottom: "12px" }}>
          Records where price fell below $0.9990, grouped by continuity (gap &gt; 6h = new event). Sorted newest first.
        </div>
      </div>

      {depegEvents.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: textSecondary, fontSize: "13px" }}>
          No depeg events recorded.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 58px 76px 84px", padding: "8px 20px", background: tableHeaderBg, borderTop: `1px solid ${headerBorder}`, borderBottom: `1px solid ${headerBorder}` }}>
            <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Coin</span>
            <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</span>
            <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Duration</span>
            <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Low</span>
            <span style={{ fontSize: "10px", fontWeight: "700", color: textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>Recovery</span>
          </div>

          {depegEvents.map((event, i) => {
            const meta = COINS.find((c) => c.slug === event.slug);
            return (
              <div
                key={`${event.slug}-${i}`}
                style={{ display: "grid", gridTemplateColumns: "1fr 90px 58px 76px 84px", padding: "12px 20px", borderBottom: `1px solid ${cardBorder}`, background: cardBg, alignItems: "center" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  {meta && (
                    <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: meta.bgColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      <img src={meta.icon} alt={event.coinName} width={14} height={14} style={{ objectFit: "contain" }} />
                    </div>
                  )}
                  <span style={{ fontSize: "13px", fontWeight: "700", color: textPrimary }}>{event.coinName}</span>
                </div>
                <span style={{ fontSize: "11px", color: textSecondary }}>{formatDate(event.startDate)}</span>
                <span style={{ fontSize: "11px", color: textSecondary, fontFamily: "monospace" }}>{formatDuration(event.durationHours)}</span>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "700", color: "#dc2626" }}>${event.lowestPrice.toFixed(4)}</span>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: event.recovered ? "#052e16" : "#451a03", color: event.recovered ? "#16a34a" : "#d97706", display: "inline-block" }}>
                  {event.recovered ? "Recovered" : "Ongoing"}
                </span>
              </div>
            );
          })}
        </>
      )}

      <div style={{ padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "8px" }}>Not financial advice</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <a href="/terms" style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: navBg, borderTop: `1px solid ${navBorder}`, display: "flex", padding: "8px 0", zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>Home</span>
        </a>
        <a href="/alerts" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>Alerts</span>
        </a>
        <a href="/history" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#1a56db" }}>History</span>
        </a>
        <a href="/about" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", textDecoration: "none", padding: "4px 0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>About</span>
        </a>
      </div>

    </main>
  );
}
