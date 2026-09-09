/**
 * One-shot live test for the two new PostgREST aggregate queries.
 * Run with: npx ts-node scripts/test-aggregate-queries.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const since = new Date();
since.setDate(since.getDate() - 7);
const sinceIso = since.toISOString();

async function run() {
  console.log(`\nWindow: last 7 days (since ${sinceIso})\n`);

  // ── 1. Baseline: exact row count ──────────────────────────────────────────
  const { count: totalCount, error: countErr } = await supabase
    .from("large_transactions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso)
    .gte("amount", 1000000);

  console.log("1. Total transfer count:", totalCount ?? "(error)", countErr?.message ?? "");

  // ── 2. Aggregate SUM (the new totalVolume query) ──────────────────────────
  const { data: volData, error: volErr } = await supabase
    .from("large_transactions")
    .select("amount.sum()")
    .gte("created_at", sinceIso)
    .gte("amount", 1000000)
    .single();

  const trueVolume = Number((volData as any)?.sum ?? 0);
  const oldVolume  = 108_090_000_000; // the $108.09B figure from the capped query

  console.log("\n2. Aggregate SUM query:");
  if (volErr) {
    console.log("   ERROR:", volErr.message);
    console.log("   → PostgREST aggregate functions may not be enabled.");
    console.log("     Go to Supabase Dashboard → Settings → API and toggle 'Enable aggregate functions'.");
  } else {
    console.log("   Raw volData:", JSON.stringify(volData));
    console.log(`   True total volume : $${(trueVolume / 1e9).toFixed(2)}B`);
    console.log(`   Old capped figure : $${(oldVolume  / 1e9).toFixed(2)}B`);
    console.log(`   Difference        : +$${((trueVolume - oldVolume) / 1e9).toFixed(2)}B`);
    console.log(`   Understatement    : ${(((trueVolume - oldVolume) / trueVolume) * 100).toFixed(1)}%`);
  }

  // ── 3. Per-coin GROUP BY (the new topCoinsByVolume query) ─────────────────
  const { data: coinRows, error: coinErr } = await supabase
    .from("large_transactions")
    .select("slug, amount.sum(), count()")
    .gte("created_at", sinceIso)
    .gte("amount", 1000000)
;

  console.log("\n3. Per-coin GROUP BY query:");
  if (coinErr) {
    console.log("   ERROR:", coinErr.message);
  } else {
    const sortedCoins = (coinRows ?? [])
      .map((r: any) => ({ slug: r.slug as string, count: Number(r.count ?? 0), volume: Number(r.sum ?? 0) }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
    console.log("   Rows returned from DB:", coinRows?.length ?? 0, "(sorted in memory)");
    console.log("   Top 10 coins by volume:");
    sortedCoins.forEach((r, i) => {
      console.log(`   ${String(i + 1).padStart(2)}. ${r.slug.padEnd(10)}  count=${String(r.count).padStart(6)}  volume=$${(r.volume / 1e9).toFixed(2)}B`);
    });
  }

  console.log();
}

run().catch(console.error);
