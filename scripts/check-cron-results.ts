/**
 * Run after a manual cron trigger to inspect what was written to large_transactions.
 * Shows per-coin counts and amounts for the last N minutes, flags decimal anomalies.
 * Usage: npx ts-node scripts/check-cron-results.ts [minutes=5]
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const MINUTES = Number(process.argv[2] ?? 5);
const since = new Date(Date.now() - MINUTES * 60 * 1000).toISOString();

const ALL_SLUGS = [
  "usdt","usdc","usds","ethena","pyusd","fdusd","rlusd","tusd",
  "frax","gho","crvusd","lusd","usdp","usdd","mkusd","eurc","dola","alusd","bold",
];

async function run() {
  console.log(`\nRows written to large_transactions in the last ${MINUTES} minutes (since ${since})\n`);

  const { data: rows, error } = await supabase
    .from("large_transactions")
    .select("slug, amount, action, tx_hash, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) { console.error("Query error:", error.message); return; }
  if (!rows?.length) { console.log("No rows written in this window — cron may not have run yet, or no qualifying transactions found."); return; }

  // Group by slug
  const byCoin: Record<string, { count: number; amounts: number[]; actions: Record<string,number> }> = {};
  for (const r of rows) {
    if (!byCoin[r.slug]) byCoin[r.slug] = { count: 0, amounts: [], actions: {} };
    byCoin[r.slug].count++;
    byCoin[r.slug].amounts.push(Number(r.amount));
    byCoin[r.slug].actions[r.action] = (byCoin[r.slug].actions[r.action] ?? 0) + 1;
  }

  // Per-coin summary
  console.log(`Total rows: ${rows.length} across ${Object.keys(byCoin).length} coins\n`);
  console.log("Slug       New rows  Min amount       Max amount       Actions");
  console.log("─────────────────────────────────────────────────────────────────────");

  const warnings: string[] = [];

  for (const slug of ALL_SLUGS) {
    const c = byCoin[slug];
    if (!c) {
      console.log(`${slug.padEnd(10)} (no new rows)`);
      continue;
    }
    const min = Math.min(...c.amounts);
    const max = Math.max(...c.amounts);
    const actStr = Object.entries(c.actions).map(([a,n]) => `${a}×${n}`).join(", ");
    const fmtAmt = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toFixed(0)}`;
    console.log(`${slug.padEnd(10)} ${String(c.count).padStart(5)} rows   ${fmtAmt(min).padStart(12)}   ${fmtAmt(max).padStart(12)}   ${actStr}`);

    // Flag decimal anomalies: max amount > $500B or min amount suspiciously tiny (< $0.01 for a "large" tx)
    if (max > 500_000_000_000) warnings.push(`⚠ ${slug}: max amount ${fmtAmt(max)} — likely decimals mismatch (too large)`);
    if (min > 0 && min < 1)    warnings.push(`⚠ ${slug}: min amount $${min} — likely decimals mismatch (too small)`);
  }

  // Coins that had zero new rows
  const missing = ALL_SLUGS.filter(s => !byCoin[s]);
  if (missing.length) {
    console.log(`\nCoins with no new rows: ${missing.join(", ")}`);
    console.log("(may be normal — no qualifying transfers ≥$100K in this Etherscan page)");
  }

  if (warnings.length) {
    console.log("\n── WARNINGS ──────────────────────────────────────────────");
    warnings.forEach(w => console.log(w));
  } else if (rows.length) {
    console.log("\n✓ No decimal anomalies detected.");
  }
  console.log();
}

run().catch(console.error);
