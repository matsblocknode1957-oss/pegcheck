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

async function run() {
  // 1. Confirm exact rows before touching anything
  const { data: rows, error: fetchErr } = await supabase
    .from("large_transactions")
    .select("created_at, amount, tx_hash, action")
    .eq("slug", "usds")
    .order("created_at", { ascending: true });

  if (fetchErr) { console.error("Fetch error:", fetchErr.message); return; }

  console.log(`\nRows to delete (slug = 'usds'): ${rows?.length ?? 0}\n`);
  rows?.forEach((r, i) =>
    console.log(`  ${i + 1}. created_at: ${r.created_at}\n     amount:     $${Number(r.amount).toLocaleString()}\n     tx_hash:    ${r.tx_hash}\n     action:     ${r.action}\n`)
  );

  if (!rows?.length) { console.log("Nothing to delete."); return; }

  // 2. Delete
  const { error: delErr } = await supabase
    .from("large_transactions")
    .delete()
    .eq("slug", "usds");

  if (delErr) { console.error("Delete error:", delErr.message); return; }
  console.log("Delete executed.\n");

  // 3. Verify
  const { count, error: countErr } = await supabase
    .from("large_transactions")
    .select("*", { count: "exact", head: true })
    .eq("slug", "usds");

  if (countErr) { console.error("Verify error:", countErr.message); return; }
  console.log(`Rows remaining for slug = 'usds': ${count ?? "unknown"}`);
  console.log(count === 0 ? "✓ Clean." : "⚠ Unexpected rows remain — check manually.");
}

run().catch(console.error);
