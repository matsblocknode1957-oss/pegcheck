"use client";
// PegCheck Agent: simulated replay of how the agent decides (rules v3.2 numbers).
// Self-contained: canvas chart + decision card + log. Colours match the /agent page.
import { useEffect, useRef, useState } from "react";

type Dec = "none" | "wait" | "buy" | "hold" | "sell" | "avoid";
type Why = [string, "good" | "bad" | ""];
interface Tick {
  t: number;
  src: Record<string, number>;
  med: number;
  dec: Dec;
  d: number;
  o: number;
  why: Why[];
  log?: [Dec, string];
  mark?: Dec;
}
interface Scenario {
  coin: string;
  tag: string;
  unit: "Hour" | "Day";
  yMin: number;
  yMax: number;
  blurb: string;
  ticks: Tick[];
  trade?: { from: number; to: number; entry: number; stop: number };
}

const COL = {
  bg: "#0f172a",
  surface: "#1e293b",
  surface2: "#162032",
  line: "#334155",
  fg: "#f1f5f9",
  fg2: "#cbd5e1",
  muted: "#94a3b8",
  dim: "#64748b",
  accent: "#60a5fa",
  buy: "#4ade80",
  sell: "#2dd4bf",
  wait: "#fbbf24",
  avoid: "#f87171",
  zone: "rgba(74, 222, 128, 0.07)",
};
const DEC_COL: Record<Dec, string> = { none: COL.line, wait: COL.wait, buy: COL.buy, hold: COL.wait, sell: COL.sell, avoid: COL.avoid };
const LABEL: Record<Dec, string> = { none: "NO DIP", wait: "WAIT", buy: "BUY", hold: "HOLD", sell: "SELL", avoid: "AVOID" };
const PEG = 1;
const TARGET = 0.998;
const fmt = (p: number) => "$" + p.toFixed(4);

function buildDip(): Scenario {
  const med = [0.9999, 1.0001, 0.9998, 1.0, 0.9999, 0.9997, 0.9995, 0.9893, 0.988, 0.989, 0.9912, 0.993, 0.9925, 0.9941, 0.995, 0.9947, 0.9958, 0.9962, 0.9969, 0.9965, 0.9974, 0.9978, 0.9983, 0.9992, 0.9996, 0.9998];
  const out: Tick[] = med.map((m, i) => ({
    t: i,
    src: { CoinGecko: m + 0.0002 * Math.sin(i * 1.7), DefiLlama: m - 0.0002 * Math.sin(i * 1.3) },
    med: m, dec: "none", d: 0, o: 0,
    why: [["No dip to buy (price is " + (Math.abs(1 - m) * 100).toFixed(2) + "% from peg)", ""]],
  }));
  out[7] = { ...out[7], dec: "wait", d: 25, o: 84, why: [["Still falling fast: down 1.0% in the last hour", "bad"], ["Price is 1.07% below peg, in the dip zone (+24 pts)", "good"], ["Won't buy while it is still falling", "bad"]], log: ["wait", "Falling fast, not buying yet"], mark: "wait" };
  out[8] = { ...out[8], dec: "buy", d: 0, o: 85, why: [["Price is 1.20% below peg, in the dip zone 0.5%–5% (+25 pts)", "good"], ["Sources agree: spread is 0.03% (under 1%)", "good"], ["No $1M+ transfers in 24 h (+25 pts)", "good"], ["Fresh dip: was at peg 2.0 hours ago (+10 pts)", "good"]], log: ["buy", "Bought $1,000 at $0.9880"], mark: "buy" };
  for (let i = 9; i <= 21; i++) out[i] = { ...out[i], dec: "hold", why: [["Holding: target is $0.9980, stop is $0.9584", ""], ["Sources agree, nothing to act on", "good"]] };
  out[22] = { ...out[22], dec: "sell", why: [["Back within 0.2% of peg: target reached", "good"], ["Both sources confirm the price", "good"]], log: ["sell", "Sold at $0.9983 · won +$10.43"], mark: "sell" };
  for (let i = 23; i < out.length; i++) out[i] = { ...out[i], why: [["Trade closed: +$10.43 on $1,000 in 14 hours", "good"]] };
  return {
    coin: "USDP", tag: "example", unit: "Hour", yMin: 0.984, yMax: 1.003,
    blurb: "A coin slips about 1% below peg. The agent waits while it is still falling, buys once the fall stops and both sources agree, then sells when the price is back near $1.",
    ticks: out, trade: { from: 8, to: 22, entry: 0.988, stop: 0.9584 },
  };
}

function buildBad(): Scenario {
  const cg = [0.9998, 0.999, 0.9922, 0.9931, 0.9943, 0.9951, 0.9956, 0.9962, 0.9975, 0.9984, 0.9993, 0.9997];
  const dl = [0.9997, 0.9989, 0.992, 0.9929, 0.9941, 0.7539, 0.7541, 0.9958, 0.9973, 0.9984, 0.9994, 0.9996];
  const out: Tick[] = cg.map((c, i) => ({ t: i, src: { CoinGecko: c, DefiLlama: dl[i] }, med: (c + dl[i]) / 2, dec: "none", d: 0, o: 0, why: [["No dip to buy", ""]] }));
  out[2] = { ...out[2], dec: "buy", d: 0, o: 82, why: [["Price is 0.79% below peg, in the dip zone (+22 pts)", "good"], ["Sources agree: spread is 0.02% (under 1%)", "good"], ["No $1M+ transfers in 24 h (+25 pts)", "good"], ["Fresh dip: was at peg 2.0 hours ago (+10 pts)", "good"]], log: ["buy", "Bought $1,000 at $0.9921"], mark: "buy" };
  out[3] = { ...out[3], dec: "hold", why: [["Holding: target is $0.9980, stop is $0.9623", ""]] };
  out[4] = { ...out[4], dec: "hold", why: [["Holding: target is $0.9980, stop is $0.9623", ""]] };
  out[5] = { ...out[5], dec: "hold", d: 25, why: [["Sources disagree: 24% apart (limit is 1%)", "bad"], ["Median $0.8745 is below the stop, but the higher source ($0.9951) is not", "bad"], ["Holding: no sale on an unconfirmed price", "good"], ["Older rules would have sold here: −$119", ""]], log: ["hold", "DefiLlama says $0.754, CoinGecko $0.995: holding"], mark: "hold" };
  out[6] = { ...out[6], dec: "hold", d: 25, why: [["Sources still disagree: 24% apart", "bad"], ["Still holding: the stop isn't confirmed", "good"]] };
  out[7] = { ...out[7], dec: "hold", why: [["Sources agree again: spread 0.04%", "good"], ["Holding: target is $0.9980", ""]] };
  out[8] = { ...out[8], dec: "hold", why: [["Holding: $0.9974, nearly at target", ""]] };
  out[9] = { ...out[9], dec: "sell", why: [["Back within 0.2% of peg: target reached", "good"]], log: ["sell", "Sold at $0.9984 · won +$6.35"], mark: "sell" };
  for (let i = 10; i < out.length; i++) out[i] = { ...out[i], why: [["Trade closed: +$6.35 instead of −$119", "good"]] };
  return {
    coin: "mkUSD", tag: "paper only", unit: "Hour", yMin: 0.955, yMax: 1.003,
    blurb: "While a trade is open, one source suddenly reports $0.75. The older rules would have taken the median, hit the stop-loss and sold at a loss. Rules v3.2 see the sources disagree and hold until the bad price goes away.",
    ticks: out, trade: { from: 2, to: 9, entry: 0.9921, stop: 0.9623 },
  };
}

function buildChronic(): Scenario {
  const med = [0.9532, 0.951, 0.9498, 0.9546, 0.9521, 0.9479, 0.9509, 0.9551, 0.9498, 0.9532, 0.9546, 0.9512, 0.9505, 0.9524];
  const ticks: Tick[] = med.map((m, i) => {
    const pct = (1 - m) * 100;
    const deep = pct > 5;
    const why: Why[] = deep
      ? [["Price is " + pct.toFixed(1) + "% below peg: deep depeg (limit is 5%)", "bad"], ["Below peg for " + (30 + i) + ".0 days: looks chronic, not a dip", "bad"]]
      : [["Below peg for " + (30 + i) + ".0 days: looks chronic, not a dip", "bad"], ["Lives below peg: 7-day median $0.9512, not a real dip", "bad"], ["Price is " + pct.toFixed(2) + "% below peg, in the dip zone", "good"]];
    const t: Tick = {
      t: i, src: { CoinGecko: m + 0.0004 * Math.sin(i), DefiLlama: m - 0.0003 * Math.sin(i * 1.4) }, med: m,
      dec: "avoid", d: deep ? 85 : 70, o: deep ? 0 : Math.round(20 + (pct / 100 - 0.005) / 0.045 * 30) + 50, why,
    };
    if (i === 0) { t.log = ["avoid", "alUSD $0.9532: chronic, staying out"]; t.mark = "avoid"; }
    if (i === 5) { t.log = ["avoid", "alUSD $0.9479: deep depeg, staying out"]; t.mark = "avoid"; }
    if (i === 13) t.log = ["avoid", "Two weeks of checks, no trade, no loss"];
    return t;
  });
  return {
    coin: "alUSD", tag: "example", unit: "Day", yMin: 0.935, yMax: 1.004,
    blurb: "Some coins sit well below $1 for weeks. On a chart that looks like a bargain. The agent checks how long the coin has been off peg and where it usually trades, and stays out.",
    ticks,
  };
}

const SCENARIOS: Record<string, Scenario> = { dip: buildDip(), bad: buildBad(), chronic: buildChronic() };
const TABS: [string, string][] = [["dip", "Buys a real dip"], ["bad", "One bad price"], ["chronic", "Too far gone"]];

const CSS = `
.ar { margin-bottom: 28px; display: flex; flex-direction: column; gap: 12px; }
.ar-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.ar-title { font-size: 15px; font-weight: 700; color: ${COL.fg}; margin: 0; }
.ar-note { font-size: 10px; color: ${COL.dim}; letter-spacing: 1px; text-transform: uppercase; }
.ar-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ar-seg { display: inline-flex; flex-wrap: wrap; padding: 3px; gap: 2px; background: ${COL.surface2}; border: 1px solid ${COL.line}; border-radius: 9px; }
.ar-seg button, .ar-play { font-family: inherit; font-size: 12px; color: ${COL.muted}; background: transparent; border: 0; border-radius: 6px; padding: 7px 11px; cursor: pointer; }
.ar-seg button[aria-pressed="true"] { background: ${COL.surface}; color: ${COL.fg}; box-shadow: inset 0 0 0 1px ${COL.line}; }
.ar-play { color: ${COL.fg}; background: ${COL.surface}; border: 1px solid ${COL.line}; border-radius: 9px; padding: 8px 12px; }
.ar-seg button:focus-visible, .ar-play:focus-visible { outline: 2px solid ${COL.accent}; outline-offset: 2px; }
.ar-blurb { margin: 0; font-size: 12px; line-height: 1.6; color: ${COL.muted}; max-width: 80ch; }
.ar-desk { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); border: 1px solid ${COL.line}; border-radius: 10px; overflow: hidden; background: ${COL.surface2}; }
.ar-chart { min-width: 0; padding: 14px 14px 8px; border-right: 1px solid ${COL.line}; }
.ar-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 10px; color: ${COL.dim}; letter-spacing: 1px; text-transform: uppercase; }
.ar-coin { font-size: 16px; font-weight: 700; color: ${COL.fg}; letter-spacing: 0; text-transform: none; }
.ar-tag { font-size: 10px; border: 1px solid ${COL.line}; border-radius: 999px; padding: 1px 7px; margin-left: 8px; color: ${COL.muted}; }
.ar canvas { display: block; width: 100%; height: 300px; }
.ar-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: ${COL.muted}; padding-top: 4px; }
.ar-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ar-legend i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.ar-card { min-width: 0; padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 12px; color: ${COL.fg2}; }
.ar-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: ${COL.muted}; }
.ar-chip { font-weight: 700; font-size: 12px; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; color: ${COL.bg}; transition: background .25s; }
.ar-label { font-size: 10px; font-weight: 700; color: ${COL.dim}; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 5px; }
.ar-src { display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
.ar-bars { display: grid; gap: 7px; }
.ar-row { display: grid; grid-template-columns: 90px 1fr 28px; gap: 8px; align-items: center; font-variant-numeric: tabular-nums; }
.ar-row span:last-child { text-align: right; }
.ar-track { height: 7px; background: ${COL.surface}; border-radius: 4px; overflow: hidden; }
.ar-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
.ar-why { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; line-height: 1.45; }
.ar-why li { padding-left: 13px; position: relative; }
.ar-why li::before { content: ""; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background: var(--dot); }
.ar-trade { border: 1px solid ${COL.line}; border-radius: 8px; padding: 9px 11px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-variant-numeric: tabular-nums; margin: 0; }
.ar-trade div { display: flex; justify-content: space-between; gap: 6px; }
.ar-trade dt { color: ${COL.dim}; } .ar-trade dd { margin: 0; }
.ar-log { border: 1px solid ${COL.line}; border-radius: 10px; background: ${COL.surface2}; padding: 9px 12px; font-size: 12px; display: grid; gap: 3px; min-height: 64px; }
.ar-log-row { display: grid; grid-template-columns: 44px 62px 1fr; gap: 10px; color: ${COL.fg2}; }
@media (max-width: 760px) {
  .ar-desk { grid-template-columns: minmax(0, 1fr); }
  .ar-chart { border-right: 0; border-bottom: 1px solid ${COL.line}; }
  .ar canvas { height: 230px; }
  .ar-trade { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .ar-fill, .ar-chip { transition: none; } }
`;

export default function AgentReplay() {
  const [sc, setSc] = useState("dip");
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({ head: 0, playing: true, pause: 0, last: 0, shown: -1, reduce: false });

  const s = SCENARIOS[sc];

  // draw the chart up to the current playhead
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sCur = SCENARIOS[scRef.current];
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = 58, R = 12, T = 12, B = 22, n = sCur.ticks.length - 1;
    const x = (i: number) => L + (i / n) * (W - L - R);
    const y = (p: number) => T + (sCur.yMax - Math.max(sCur.yMin, Math.min(sCur.yMax, p))) / (sCur.yMax - sCur.yMin) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px monospace";

    const zTop = y(PEG * 0.995), zBot = y(Math.max(sCur.yMin, PEG * 0.95));
    ctx.fillStyle = COL.zone; ctx.fillRect(L, zTop, W - L - R, zBot - zTop);
    ctx.fillStyle = COL.buy; ctx.globalAlpha = 0.7; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText("buy zone", W - R - 4, zTop + 14); ctx.globalAlpha = 1;

    const step = sCur.yMax - sCur.yMin > 0.03 ? 0.01 : 0.005;
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.fillStyle = COL.dim; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let p = Math.ceil(sCur.yMin / step) * step; p <= sCur.yMax + 1e-9; p += step) {
      const yy = Math.round(y(p)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
      ctx.fillText("$" + p.toFixed(3), L - 8, yy);
    }
    ctx.strokeStyle = COL.fg2; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(L, y(PEG)); ctx.lineTo(W - R, y(PEG)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "left"; ctx.fillStyle = COL.fg2; ctx.fillText("peg $1.00", L + 4, y(PEG) - 8);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = COL.dim;
    const every = n > 20 ? 4 : 2;
    for (let i = 0; i <= n; i += every) ctx.fillText((sCur.unit === "Hour" ? "h" : "d") + i, x(i), H - 5);

    const hi = Math.min(st.current.head, n), whole = Math.floor(hi), frac = hi - whole;
    const tr = sCur.trade;
    if (tr && hi >= tr.from) {
      const end = x(Math.min(hi, tr.to));
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.strokeStyle = COL.sell; ctx.beginPath(); ctx.moveTo(x(tr.from), y(TARGET)); ctx.lineTo(end, y(TARGET)); ctx.stroke();
      if (tr.stop >= sCur.yMin) { ctx.strokeStyle = COL.avoid; ctx.beginPath(); ctx.moveTo(x(tr.from), y(tr.stop)); ctx.lineTo(end, y(tr.stop)); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    const names = Object.keys(sCur.ticks[0].src);
    names.forEach((nm, k) => {
      ctx.strokeStyle = k === 0 ? COL.accent : COL.muted; ctx.lineWidth = k === 0 ? 2.2 : 1.4; ctx.globalAlpha = k === 0 ? 1 : 0.75;
      ctx.beginPath();
      for (let i = 0; i <= whole; i++) { const p = sCur.ticks[i].src[nm]; if (i) ctx.lineTo(x(i), y(p)); else ctx.moveTo(x(i), y(p)); }
      if (whole < n && frac > 0) {
        const a = sCur.ticks[whole].src[nm], b = sCur.ticks[whole + 1].src[nm];
        ctx.lineTo(x(whole + frac), y(a + (b - a) * frac));
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    for (let i = 0; i <= whole; i++) {
      Object.entries(sCur.ticks[i].src).forEach(([nm, p]) => {
        if (p >= sCur.yMin) return;
        const xx = x(i), yy = y(sCur.yMin) - 2;
        ctx.fillStyle = COL.avoid;
        ctx.beginPath(); ctx.moveTo(xx - 6, yy - 10); ctx.lineTo(xx + 6, yy - 10); ctx.lineTo(xx, yy); ctx.closePath(); ctx.fill();
        if (i === 5) { const right = xx > W * 0.55; ctx.textAlign = right ? "right" : "left"; ctx.fillText(nm + " $" + p.toFixed(3) + " ↓", right ? xx - 10 : xx + 10, yy - 4); }
      });
    }
    for (let i = 0; i <= whole; i++) {
      const tk = sCur.ticks[i];
      if (!tk.mark) continue;
      const p = tk.mark === "hold" ? Math.max(...Object.values(tk.src)) : tk.med;
      const xx = x(i), yy = y(p);
      ctx.fillStyle = DEC_COL[tk.mark]; ctx.beginPath(); ctx.arc(xx, yy, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COL.surface2; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillText(LABEL[tk.mark], xx, tk.mark === "sell" || tk.mark === "avoid" ? yy - 12 : yy + 20);
      ctx.font = "11px monospace";
    }
  };

  const scRef = useRef(sc);

  const reset = (key: string) => {
    scRef.current = key;
    const n = SCENARIOS[key].ticks.length - 1;
    st.current.head = st.current.reduce ? n : 0;
    st.current.pause = 0;
    st.current.shown = st.current.reduce ? n : 0;
    setShown(st.current.shown);
    setSc(key);
    draw();
  };

  useEffect(() => {
    st.current.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (st.current.reduce) { st.current.playing = false; setPlaying(false); reset("dip"); }
    let raf = 0;
    const frame = (ts: number) => {
      const r = st.current;
      const dt = r.last ? Math.min(100, ts - r.last) : 0;
      r.last = ts;
      if (r.playing) {
        const n = SCENARIOS[scRef.current].ticks.length - 1;
        if (r.pause > 0) r.pause -= dt;
        else if (r.head < n) r.head = Math.min(n, r.head + dt / 650);
        else { r.head += dt / 650; if (r.head > n + 4) { reset(scRef.current); } }
        const i = Math.min(Math.floor(r.head), n);
        if (i !== r.shown) {
          r.shown = i; setShown(i);
          if (SCENARIOS[scRef.current].ticks[i].mark) r.pause = 1400;
        }
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (key: string) => {
    reset(key);
    if (!st.current.reduce) { st.current.playing = true; setPlaying(true); }
  };
  const toggle = () => {
    if (st.current.reduce) { st.current.head = 0; st.current.shown = -1; }
    st.current.playing = !st.current.playing;
    setPlaying(st.current.playing);
  };

  const tk = s.ticks[Math.min(shown, s.ticks.length - 1)];
  const vals = Object.entries(tk.src);
  const ps = vals.map((v) => v[1]);
  const spread = (Math.max(...ps) - Math.min(...ps)) / Math.max(...ps);
  const agree = spread < 0.01;
  const tr = s.trade;
  let tradeBox = null;
  if (tr && shown >= tr.from) {
    const closed = shown >= tr.to;
    const price = closed ? s.ticks[tr.to].med : tk.dec === "hold" && !agree ? Math.max(...ps) : tk.med;
    const pnl = (1000 / tr.entry) * price - 1000;
    tradeBox = (
      <dl className="ar-trade">
        <div><dt>Entry</dt><dd>{fmt(tr.entry)}</dd></div>
        <div><dt>Size</dt><dd>$1,000</dd></div>
        <div><dt>Target</dt><dd>$0.9980</dd></div>
        <div><dt>Stop</dt><dd>{fmt(tr.stop)}</dd></div>
        <div><dt>{closed ? "Result" : "Open P&L"}</dt><dd style={{ color: pnl >= 0 ? COL.buy : COL.avoid }}>{(pnl >= 0 ? "+" : "−") + "$" + Math.abs(pnl).toFixed(2)}</dd></div>
        <div><dt>Time limit</dt><dd>7 days</dd></div>
      </dl>
    );
  }
  const logs = s.ticks.slice(0, shown + 1).filter((t) => t.log);

  return (
    <section className="ar" aria-label="How the agent decides">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ar-head">
        <h2 className="ar-title">How it decides</h2>
        <span className="ar-note">Simulated replay · rules v3.2 · time compressed</span>
      </div>
      <div className="ar-bar">
        <div className="ar-seg" role="group" aria-label="Scenario">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sc === k} onClick={() => pick(k)}>{label}</button>
          ))}
        </div>
        <button type="button" className="ar-play" onClick={toggle}>{playing ? "Pause" : "Play"}</button>
      </div>
      <p className="ar-blurb">{s.blurb}</p>
      <div className="ar-desk">
        <div className="ar-chart">
          <div className="ar-chart-head">
            <span><span className="ar-coin">{s.coin}</span><span className="ar-tag">{s.tag}</span></span>
            <span>price in USD</span>
          </div>
          <canvas ref={canvasRef} role="img" aria-label={"Price chart: " + s.blurb} />
          <div className="ar-legend">
            <span><i style={{ background: COL.accent }} />{Object.keys(s.ticks[0].src)[0]}</span>
            <span><i style={{ background: COL.muted }} />{Object.keys(s.ticks[0].src)[1]}</span>
            {tr && <span><i style={{ background: COL.sell }} />target $0.998</span>}
            {tr && tr.stop >= s.yMin && <span><i style={{ background: COL.avoid }} />stop</span>}
          </div>
        </div>
        <div className="ar-card" aria-live="polite">
          <div className="ar-card-top">
            <span>{s.unit} {tk.t}</span>
            <span className="ar-chip" style={{ background: DEC_COL[tk.dec], color: tk.dec === "none" ? COL.fg2 : COL.bg }}>{LABEL[tk.dec]}</span>
          </div>
          <div>
            <div className="ar-label">Price sources</div>
            {vals.map(([n, p]) => (
              <div className="ar-src" key={n}><span>{n}</span><span style={{ color: p < 0.9 ? COL.avoid : undefined }}>{fmt(p)}</span></div>
            ))}
            <div style={{ marginTop: 4, color: agree ? COL.buy : COL.avoid }}>
              {agree ? `Sources agree · ${(spread * 100).toFixed(2)}% apart` : `Sources disagree · ${(spread * 100).toFixed(0)}% apart`}
            </div>
          </div>
          <div className="ar-bars">
            <div className="ar-row"><span>Danger</span><div className="ar-track"><div className="ar-fill" style={{ width: tk.d + "%", background: COL.avoid }} /></div><span>{tk.d}</span></div>
            <div className="ar-row"><span>Opportunity</span><div className="ar-track"><div className="ar-fill" style={{ width: tk.o + "%", background: COL.buy }} /></div><span>{tk.o}</span></div>
          </div>
          <div>
            <div className="ar-label">Why</div>
            <ul className="ar-why">
              {tk.why.map(([t, c], i) => (
                <li key={i} style={{ ["--dot" as string]: c === "good" ? COL.buy : c === "bad" ? COL.avoid : COL.dim }}>{t}</li>
              ))}
            </ul>
          </div>
          {tradeBox}
        </div>
      </div>
      <div className="ar-log" aria-label="Decision log">
        {logs.length === 0 ? (
          <div style={{ color: COL.dim }}>The agent&apos;s decisions will appear here.</div>
        ) : (
          logs.map((t) => (
            <div className="ar-log-row" key={t.t}>
              <span>{(s.unit === "Hour" ? "h" : "d") + String(t.t).padStart(2, "0")}</span>
              <b style={{ color: DEC_COL[t.log![0]] }}>{LABEL[t.log![0]]}</b>
              <span>{t.log![1]}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
