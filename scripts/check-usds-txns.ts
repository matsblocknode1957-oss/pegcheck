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

const TARGET = 485_384_143;
const TOLERANCE = 1000; // ±$1000

async function run() {
  // 1. Total row count for usds
  const { count: total } = await supabase
    .from("large_transactions")
    .select("*", { count: "exact", head: true })
    .eq("slug", "usds");
  console.log("Total usds rows in large_transactions:", total ?? 0);

  if (!total) { console.log("No usds rows — slug may differ or table is empty for this coin."); return; }

  // 2. Date range
  const { data: oldest } = await supabase
    .from("large_transactions")
    .select("created_at, amount")
    .eq("slug", "usds")
    .order("created_at", { ascending: true })
    .limit(1);
  const { data: newest } = await supabase
    .from("large_transactions")
    .select("created_at, amount")
    .eq("slug", "usds")
    .order("created_at", { ascending: false })
    .limit(1);
  console.log("Oldest usds row:", oldest?.[0]);
  console.log("Newest usds row:", newest?.[0]);

  // 3. Last 7 days
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { count: recentCount, data: recentRows } = await supabase
    .from("large_transactions")
    .select("created_at, amount, action, tx_hash", { count: "exact" })
    .eq("slug", "usds")
    .gte("created_at", since.toISOString())
    .order("amount", { ascending: false })
    .limit(10);
  console.log(`\nUsds rows in last 7 days: ${recentCount ?? 0}`);
  if (recentRows?.length) {
    console.log("Top rows by amount:");
    recentRows.forEach(r => console.log(" ", r.created_at, `$${Number(r.amount).toLocaleString()}`, r.action, r.tx_hash?.slice(0, 12)));
  }

  // 4. Search for the ~$485M transaction (all time)
  const { data: target } = await supabase
    .from("large_transactions")
    .select("created_at, amount, action, tx_hash")
    .eq("slug", "usds")
    .gte("amount", TARGET - TOLERANCE)
    .lte("amount", TARGET + TOLERANCE);
  console.log(`\nSearch for ~$${TARGET.toLocaleString()} (±$${TOLERANCE.toLocaleString()}):`);
  if (target?.length) {
    target.forEach(r => console.log(" FOUND:", r.created_at, `$${Number(r.amount).toLocaleString()}`, r.tx_hash));
  } else {
    console.log(" Not found in large_transactions.");
  }
}

run().catch(console.error);
