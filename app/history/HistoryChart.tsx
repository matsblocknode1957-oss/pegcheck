"use client";
import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { COIN_PEGS } from "@/lib/coinPegs";

interface CoinOption {
  slug: string;
  name: string;
}

interface ChartPoint {
  time: string;
  price: number;
}

const bg = "#0a0e1a";
const cardBg = "#0d1628";
const cardBorder = "#1e2a40";
const textPrimary = "#f9fafb";
const textSecondary = "#6b7280";
const inputBg = "#111f38";

export default function HistoryChart({ coins }: { coins: CoinOption[] }) {
  const [selectedSlug, setSelectedSlug] = useState(coins[0]?.slug ?? "usdt");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/history/chart?slug=${selectedSlug}`);
        const json = await res.json();
        if (!cancelled) {
          if (json.error) throw new Error(json.error);
          setChartData(json.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedSlug]);

  const peg = COIN_PEGS[selectedSlug] ?? 1.0;
  const prices = chartData.map((d) => d.price);
  const dataMin = prices.length ? Math.min(...prices) : peg * 0.9985;
  const dataMax = prices.length ? Math.max(...prices) : peg * 1.0015;
  const yMin = parseFloat(Math.min(dataMin - 0.0005, peg * 0.9985).toFixed(4));
  const yMax = parseFloat(Math.max(dataMax + 0.0005, peg * 1.0015).toFixed(4));

  const formatXTick = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const pt: ChartPoint = payload[0].payload;
    const price = Number(payload[0].value);
    const diff = Math.abs(price - peg) / peg;
    const priceColor = diff > 0.005 ? "#dc2626" : diff > 0.001 ? "#d97706" : "#16a34a";
    return (
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "8px", padding: "8px 12px" }}>
        <div style={{ fontSize: "11px", color: textSecondary, marginBottom: "4px" }}>
          {new Date(pt.time).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: "15px", fontWeight: "700", color: priceColor, fontFamily: "monospace" }}>
          ${price.toFixed(6)}
        </div>
      </div>
    );
  };

  return (
    <div>
      <select
        value={selectedSlug}
        onChange={(e) => setSelectedSlug(e.target.value)}
        style={{
          background: inputBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "8px",
          color: textPrimary,
          fontSize: "13px",
          fontWeight: "600",
          padding: "8px 12px",
          marginBottom: "14px",
          cursor: "pointer",
          outline: "none",
          fontFamily: "'Segoe UI', sans-serif",
          appearance: "none",
          WebkitAppearance: "none",
          paddingRight: "32px",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
        }}
      >
        {coins.map((coin) => (
          <option key={coin.slug} value={coin.slug} style={{ background: "#0d1628" }}>
            {coin.name}
          </option>
        ))}
      </select>

      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px 8px 8px 0" }}>
        {loading ? (
          <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary, fontSize: "13px" }}>
            Loading chart data…
          </div>
        ) : error ? (
          <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontSize: "13px" }}>
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary, fontSize: "13px" }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a40" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={formatXTick}
                tick={{ fill: textSecondary, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#1e2a40" }}
                interval="preserveStartEnd"
                minTickGap={80}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                tick={{ fill: textSecondary, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={68}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={peg}
                stroke="#374151"
                strokeDasharray="5 4"
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#1a56db"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: "#1a56db", stroke: cardBg, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
