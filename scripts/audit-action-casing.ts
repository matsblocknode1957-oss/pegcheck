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

async function count(action: string) {
  const { count } = await supabase
    .from("large_transactions")
    .select("*", { count: "exact", head: true })
    .eq("action", action);
  return count ?? 0;
}

async function run() {
  const [ltOld, mintOld, burnOld, ltNew, mintNew, burnNew] = await Promise.all([
    count("large_transfer"),
    count("mint"),
    count("burn"),
    count("LARGE TRANSFER"),
    count("MINT"),
    count("BURN"),
  ]);

  console.log("\naction value          rows");
  console.log("──────────────────────────────");
  console.log(`"large_transfer"      ${ltOld}   ← old`);
  console.log(`"mint"                ${mintOld}   ← old`);
  console.log(`"burn"                ${burnOld}   ← old`);
  console.log(`"LARGE TRANSFER"      ${ltNew}   ← new`);
  console.log(`"MINT"                ${mintNew}   ← new`);
  console.log(`"BURN"                ${burnNew}   ← new`);
  console.log(`\nOld-format rows to backfill if desired: ${ltOld + mintOld + burnOld}`);
}

run().catch(console.error);
