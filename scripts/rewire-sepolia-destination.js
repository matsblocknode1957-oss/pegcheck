// One-time script: swap the Ethereum Sepolia destination on Arbitrum Sepolia StableGuard
// from the old receiver to the new one that has MockVault wired.

const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const STABLEGUARD       = "0xb94af0F75ed9E431B32449980Ca4D57681c580e4";
const SEPOLIA_SELECTOR  = 16015286601757825753n;
const OLD_RECEIVER      = "0x4E22DcAa7abc7701144b737827613A99343beD3d";
const NEW_RECEIVER      = "0x70b88C8877f7Ec11500b75ff9cad37312A739AFF";

const ABI = [
  "function removeDestination(uint64 chainSelector) external",
  "function addDestination(uint64 chainSelector, address receiver) external",
  "function destinations(uint256 index) external view returns (uint64 chainSelector, address receiver)",
];

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY
    ?.replace(/^0x/, "")
    .replace(/^[^0-9a-fA-F]+/, "");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  const provider  = new ethers.JsonRpcProvider(
    process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const wallet    = new ethers.Wallet(pk, provider);
  const sg        = new ethers.Contract(STABLEGUARD, ABI, wallet);

  console.log("─".repeat(60));
  console.log("Rewiring Ethereum Sepolia destination on Arbitrum StableGuard");
  console.log("─".repeat(60));
  console.log("StableGuard:  ", STABLEGUARD);
  console.log("Selector:     ", SEPOLIA_SELECTOR.toString(), "(Ethereum Sepolia)");
  console.log("Old receiver: ", OLD_RECEIVER);
  console.log("New receiver: ", NEW_RECEIVER);
  console.log("─".repeat(60));

  // ── 1. removeDestination ────────────────────────────────────────────────────
  console.log("\n[1/2] removeDestination(Ethereum Sepolia)...");
  const removeTx = await sg.removeDestination(SEPOLIA_SELECTOR);
  process.stdout.write(`      tx: ${removeTx.hash}  `);
  await removeTx.wait();
  console.log("✓");

  // ── 2. addDestination ────────────────────────────────────────────────────────
  console.log("\n[2/2] addDestination(Ethereum Sepolia, new receiver)...");
  const addTx = await sg.addDestination(SEPOLIA_SELECTOR, NEW_RECEIVER);
  process.stdout.write(`      tx: ${addTx.hash}  `);
  await addTx.wait();
  console.log("✓");

  // ── Verify: scan destinations array for the new entry ────────────────────────
  console.log("\nVerifying destinations array...");
  let found = false;
  for (let i = 0; ; i++) {
    try {
      const [sel, rec] = await sg.destinations(i);
      const mark = sel === SEPOLIA_SELECTOR ? (rec.toLowerCase() === NEW_RECEIVER.toLowerCase() ? "✓" : "✗ wrong receiver") : " ";
      console.log(`  [${i}] selector: ${sel}  receiver: ${rec}  ${mark}`);
      if (sel === SEPOLIA_SELECTOR && rec.toLowerCase() === NEW_RECEIVER.toLowerCase()) found = true;
    } catch {
      break; // past end of array
    }
  }

  if (!found) throw new Error("New receiver not found in destinations — check above");
  console.log("\n✓ Ethereum Sepolia destination now routes to new receiver.");
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exitCode = 1;
});
