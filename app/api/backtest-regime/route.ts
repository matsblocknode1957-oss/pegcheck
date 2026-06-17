import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classify } from "@/lib/regime/classifier";
import { COIN_PEGS } from "@/lib/coinPegs";
import type { PricePoint, BacktestRow, RegimeClassification, LayerBTrajectory } from "@/lib/regime/types";

// Only coins known to have had depeg events
const BACKTEST_SLUGS = ["alusd", "eurc", "mkusd", "frax", "dola", "lusd"];

const EVENT_THRESHOLD_BPS = 50;  // HEDGE threshold — same basis as the 37 known events
const WINDOW_HOURS = 48;

interface RawRow {
  created_at: string;
  price: number;
  deviation_bps: number | null;
}

async function fetchAllForCoin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  slug: string,
): Promise<PricePoint[]> {
  const peg = COIN_PEGS[slug] ?? 1.0;
  const all: PricePoint[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("price_history")
      .select("created_at, price, deviation_bps")
      .eq("slug", slug)
      .order("created_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const r of data as RawRow[]) {
      const dev = r.deviation_bps != null
        ? r.deviation_bps
        : Math.round((r.price - peg) / peg * 10_000);
      if (isNaN(dev) || r.price <= 0) continue;
      all.push({ created_at: r.created_at, deviation_bps: dev });
    }

    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

function buildRow(
  slug: string,
  records: PricePoint[],
  classifications: RegimeClassification[],
  eventStart: string,
  eventEnd: string | null,
  firstBreachIdx: number,
  peakSev: number,
  peakIdx: number,
): BacktestRow {
  const peakCls = classifications[peakIdx];

  // Search back up to 200 records before first breach for a SLIDE or WOBBLE precursor
  const searchFrom = Math.max(0, firstBreachIdx - 200);
  let firstWarningIdx: number | null = null;
  let firstWarning: "SLIDE" | "WOBBLE" | null = null;

  for (let j = searchFrom; j < firstBreachIdx; j++) {
    const traj = classifications[j]?.layer_b as LayerBTrajectory;
    if (traj === "SLIDE" || traj === "WOBBLE") {
      firstWarningIdx = j;
      firstWarning = traj;
      break;
    }
  }

  const hoursLead = firstWarningIdx !== null
    ? Math.round(
        (new Date(records[firstBreachIdx].created_at).getTime() -
          new Date(records[firstWarningIdx!].created_at).getTime()) /
          360_000
      ) / 10
    : null;

  return {
    coin: slug.toUpperCase(),
    event_start: eventStart,
    event_end: eventEnd,
    peak_severity_bps: Math.round(peakSev),
    layer_a: peakCls?.layer_a ?? "NONE",
    layer_b_at_break: peakCls?.layer_b ?? "STABLE",
    confidence_at_break: peakCls?.confidence ?? 0,
    first_warning: firstWarning,
    hours_lead: hoursLead,
  };
}

// Merge events where the quiet gap between them is less than MERGE_GAP_HOURS.
// This handles sub-hourly price records that create spurious micro-events.
const MERGE_GAP_HOURS = 6;

function mergeEvents(events: BacktestRow[]): BacktestRow[] {
  if (events.length === 0) return events;
  const out: BacktestRow[] = [];
  let cur = { ...events[0] };

  for (let i = 1; i < events.length; i++) {
    const next = events[i];
    const gapMs = cur.event_end
      ? new Date(next.event_start).getTime() - new Date(cur.event_end).getTime()
      : 0;

    if (gapMs < MERGE_GAP_HOURS * 3_600_000) {
      // Extend the current event to cover next
      cur.event_end = next.event_end;
      if (next.peak_severity_bps > cur.peak_severity_bps) {
        cur.peak_severity_bps = next.peak_severity_bps;
        cur.layer_a = next.layer_a;
        cur.layer_b_at_break = next.layer_b_at_break;
        cur.confidence_at_break = next.confidence_at_break;
      }
      // Keep the earliest warning signal
      if (cur.first_warning === null && next.first_warning !== null) {
        cur.first_warning = next.first_warning;
        cur.hours_lead = next.hours_lead;
      }
    } else {
      out.push(cur);
      cur = { ...next };
    }
  }
  out.push(cur);
  return out;
}

function backtestCoin(records: PricePoint[], slug: string): BacktestRow[] {
  if (records.length < 10) return [];

  const windowMs = WINDOW_HOURS * 3_600_000;

  // Compute a classification for every record using a sliding 48h window
  const classifications: RegimeClassification[] = [];
  let windowStart = 0;

  for (let i = 0; i < records.length; i++) {
    const nowMs = new Date(records[i].created_at).getTime();
    while (
      windowStart < i &&
      nowMs - new Date(records[windowStart].created_at).getTime() > windowMs
    ) {
      windowStart++;
    }
    classifications.push(classify(records.slice(windowStart, i + 1), slug, records[i].created_at));
  }

  // Event detection: contiguous periods where severity >= EVENT_THRESHOLD_BPS
  const rawEvents: BacktestRow[] = [];
  let inEvent = false;
  let eventStartTs = "";
  let firstBreachIdx = -1;
  let peakSev = 0;
  let peakIdx = -1;

  for (let i = 0; i < records.length; i++) {
    const sev = Math.abs(records[i].deviation_bps);

    if (!inEvent && sev >= EVENT_THRESHOLD_BPS) {
      inEvent = true;
      eventStartTs = records[i].created_at;
      firstBreachIdx = i;
      peakSev = sev;
      peakIdx = i;
    } else if (inEvent) {
      if (sev > peakSev) { peakSev = sev; peakIdx = i; }

      if (sev < EVENT_THRESHOLD_BPS) {
        rawEvents.push(buildRow(slug, records, classifications, eventStartTs, records[i].created_at, firstBreachIdx, peakSev, peakIdx));
        inEvent = false;
        firstBreachIdx = -1;
        peakSev = 0;
      }
    }
  }

  // Still-ongoing event at the end of records
  if (inEvent && firstBreachIdx !== -1) {
    rawEvents.push(buildRow(slug, records, classifications, eventStartTs, null, firstBreachIdx, peakSev, peakIdx));
  }

  return mergeEvents(rawEvents);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slugParam = searchParams.get("coin");
  const slugs = slugParam
    ? [slugParam.toLowerCase()].filter(s => BACKTEST_SLUGS.includes(s))
    : BACKTEST_SLUGS;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const t0 = Date.now();
  const allRows: BacktestRow[] = [];
  const meta: Record<string, { records_fetched: number; events_found: number }> = {};

  // Fetch coins sequentially to avoid overwhelming Supabase connection pool
  for (const slug of slugs) {
    const records = await fetchAllForCoin(supabase, slug);
    const rows = backtestCoin(records, slug);
    meta[slug] = { records_fetched: records.length, events_found: rows.length };
    allRows.push(...rows);
  }

  allRows.sort((a, b) => a.event_start.localeCompare(b.event_start));

  const withLead = allRows.filter(r => r.hours_lead !== null);
  const avgLead = withLead.length
    ? Math.round(withLead.reduce((s, r) => s + (r.hours_lead ?? 0), 0) / withLead.length * 10) / 10
    : null;

  const summary = {
    elapsed_ms: Date.now() - t0,
    total_events: allRows.length,
    slide_precursors: allRows.filter(r => r.first_warning === "SLIDE").length,
    wobble_precursors: allRows.filter(r => r.first_warning === "WOBBLE").length,
    no_precursor: allRows.filter(r => r.first_warning === null).length,
    avg_lead_hours: avgLead,
    coins: meta,
  };

  return NextResponse.json({ summary, events: allRows });
}
