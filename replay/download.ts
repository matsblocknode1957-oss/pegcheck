/**
 * Downloads price_history from Supabase into replay/data/ for offline replay.
 *
 * Run from the project root:
 *   npx tsx replay/download.ts
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Creates replay/data/{coin}.jsonl (one JSON object per line) and replay/data/seeds.json.
 * Data directory is gitignored — never committed.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { COIN_PEGS } from "@/lib/coinPegs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COINS = [
  "mkusd", "usdp", "bold", "alusd", "frax",
  "lusd", "usdc", "usdt", "gho", "crvusd",
];

const DAYS   = 60;
const PAGE   = 1000;

const DATA_DIR = path.resolve(process.cwd(), "replay/data");

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PhRow {
  id: number;
  created_at: string;
  price: number;
  deviation_bps: number | null;
}

interface Seeds {
  firstSeen: string | null;
  lastAtPegBeforeWindow: string | null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function downloadCoin(slug: string, since: string): Promise<{ rows: number }> {
  const peg = COIN_PEGS[slug];
  if (peg === undefined) {
    console.warn(`  [${slug}] No peg defined in COIN_PEGS — skipping`);
    return { rows: 0 };
  }

  const outPath = path.join(DATA_DIR, `${slug}.jsonl`);
  const stream  = fs.createWriteStream(outPath, { flags: "w" });

  let offset = 0;
  let total  = 0;

  while (true) {
    const { data, error } = await supabase
      .from("price_history")
      .select("id, created_at, price, deviation_bps")
      .eq("slug", slug)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id",         { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      stream.end();
      throw new Error(`[${slug}] page error at offset ${offset}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data as PhRow[]) {
      // If deviation_bps was null (pre-migration rows), compute from price
      const devBps = row.deviation_bps ?? Math.round(((row.price - peg) / peg) * 10_000);
      stream.write(JSON.stringify({ id: row.id, created_at: row.created_at, price: row.price, deviation_bps: devBps }) + "\n");
    }

    total += data.length;
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  return { rows: total };
}

async function fetchSeeds(slug: string, since: string): Promise<Seeds> {
  // first_seen = global min(created_at) for this coin
  const { data: fsData } = await supabase
    .from("price_history")
    .select("created_at")
    .eq("slug", slug)
    .order("created_at", { ascending: true })
    .limit(1);

  const firstSeen = fsData?.[0]?.created_at ?? null;

  // last_at_peg BEFORE the download window: max(created_at) where |deviation_bps| <= 49
  // We use <= 49 because deviation_bps is integer and |x| < 50 means -49 <= x <= 49
  const { data: lapData } = await supabase
    .from("price_history")
    .select("created_at")
    .eq("slug", slug)
    .gte("deviation_bps", -49)
    .lte("deviation_bps",  49)
    .lt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAtPegBeforeWindow = lapData?.[0]?.created_at ?? null;

  return { firstSeen, lastAtPegBeforeWindow };
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const now   = new Date();
  const since = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  console.log(`Downloading ${DAYS} days of price_history (since ${since.slice(0, 10)}) for ${COINS.length} coins...\n`);

  const allSeeds: Record<string, Seeds> = {};

  for (const slug of COINS) {
    process.stdout.write(`  ${slug.padEnd(8)} seeds...`);
    const seeds = await fetchSeeds(slug, since);
    allSeeds[slug] = seeds;
    process.stdout.write(` rows...`);
    const { rows } = await downloadCoin(slug, since);
    console.log(` ${rows.toLocaleString()} rows  (first_seen=${seeds.firstSeen?.slice(0, 10) ?? "none"}, last_at_peg_before_window=${seeds.lastAtPegBeforeWindow?.slice(0, 10) ?? "none"})`);
  }

  fs.writeFileSync(path.join(DATA_DIR, "seeds.json"), JSON.stringify(allSeeds, null, 2));
  console.log(`\nDone. Data written to replay/data/`);
  console.log(`  ${COINS.map(s => `${s}.jsonl`).join(", ")}`);
  console.log(`  seeds.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
