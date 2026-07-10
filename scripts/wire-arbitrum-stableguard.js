// Wire up the newly deployed Arbitrum Sepolia StableGuard (0xb94af0...).
// Hits three networks in one run:
//   Arbitrum Sepolia — fund + addDestination x2
//   Ethereum Sepolia — setTrustedSender on existing receiver
//   Robinhood Chain  — setTrustedSender on existing receiver

const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

// ── Addresses ─────────────────────────────────────────────────────────────────
const STABLEGUARD        = "0xb94af0F75ed9E431B32449980Ca4D57681c580e4"; // Arbitrum Sepolia
const SEPOLIA_RECEIVER   = "0x4E22DcAa7abc7701144b737827613A99343beD3d"; // Ethereum Sepolia
const ROBINHOOD_RECEIVER = "0x6381383Ff70434A7681Bc329D89b3a7AC17129A8"; // Robinhood Chain

const SEPOLIA_SELECTOR   = 16015286601757825753n;
const ROBINHOOD_SELECTOR = 2032988798112970440n;
const FUND_AMOUNT        = ethers.parseEther("0.1");

// ── ABIs (minimal) ────────────────────────────────────────────────────────────
const STABLEGUARD_ABI = [
  "function addDestination(uint64 chainSelector, address receiver) external",
];
const RECEIVER_ABI = [
  "function setTrustedSender(address sender) external",
  "function trustedSender() external view returns (address)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function step(label, fn) {
  process.stdout.write(`  ${label}... `);
  const tx = await fn();
  const receipt = await tx.wait();
  console.log(`✓  ${tx.hash}`);
  return receipt;
}

async function main() {
  // Strip any leading non-hex characters (e.g. the 'y' prefix quirk in .env.local)
  const pk = process.env.DEPLOYER_PRIVATE_KEY
    ?.replace(/^0x/, "")
    .replace(/^[^0-9a-fA-F]+/, "");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  const arbProvider      = new ethers.JsonRpcProvider(
    process.env.ARB_SEPOLIA_RPC_URL  || "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const sepoliaProvider  = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL      || "https://eth-sepolia.g.alchemy.com/v2/J55OLMq9Jt9zmd6GcP0MO"
  );
  const robinhoodProvider = new ethers.JsonRpcProvider(
    process.env.ROBINHOOD_RPC_URL    || "https://rpc.testnet.chain.robinhood.com"
  );

  const arbWallet       = new ethers.Wallet(pk, arbProvider);
  const sepoliaWallet   = new ethers.Wallet(pk, sepoliaProvider);
  const robinhoodWallet = new ethers.Wallet(pk, robinhoodProvider);

  const stableGuard       = new ethers.Contract(STABLEGUARD,        STABLEGUARD_ABI, arbWallet);
  const sepoliaReceiver   = new ethers.Contract(SEPOLIA_RECEIVER,   RECEIVER_ABI,    sepoliaWallet);
  const robinhoodReceiver = new ethers.Contract(ROBINHOOD_RECEIVER, RECEIVER_ABI,    robinhoodWallet);

  console.log("─".repeat(60));
  console.log("Wiring StableGuard:", STABLEGUARD);
  console.log("Deployer:          ", arbWallet.address);
  console.log("─".repeat(60));

  // ── 1. Fund StableGuard on Arbitrum Sepolia ──────────────────────────────
  console.log("\n[1/5] Fund StableGuard with 0.1 ETH (Arbitrum Sepolia)");
  await step("sending ETH", () =>
    arbWallet.sendTransaction({ to: STABLEGUARD, value: FUND_AMOUNT })
  );

  // ── 2. addDestination → Ethereum Sepolia ─────────────────────────────────
  console.log("\n[2/5] addDestination → Ethereum Sepolia (Arbitrum Sepolia)");
  console.log(`  selector: ${SEPOLIA_SELECTOR}`);
  console.log(`  receiver: ${SEPOLIA_RECEIVER}`);
  await step("addDestination", () =>
    stableGuard.addDestination(SEPOLIA_SELECTOR, SEPOLIA_RECEIVER)
  );

  // ── 3. addDestination → Robinhood Chain ──────────────────────────────────
  console.log("\n[3/5] addDestination → Robinhood Chain (Arbitrum Sepolia)");
  console.log(`  selector: ${ROBINHOOD_SELECTOR}`);
  console.log(`  receiver: ${ROBINHOOD_RECEIVER}`);
  await step("addDestination", () =>
    stableGuard.addDestination(ROBINHOOD_SELECTOR, ROBINHOOD_RECEIVER)
  );

  // ── 4. Authorise on Ethereum Sepolia receiver ─────────────────────────────
  console.log("\n[4/5] setTrustedSender on Ethereum Sepolia receiver");
  console.log(`  receiver: ${SEPOLIA_RECEIVER}`);
  console.log(`  sender:   ${STABLEGUARD}`);
  await step("setTrustedSender", () =>
    sepoliaReceiver.setTrustedSender(STABLEGUARD)
  );

  // ── 5. Authorise on Robinhood Chain receiver ──────────────────────────────
  console.log("\n[5/5] setTrustedSender on Robinhood Chain receiver");
  console.log(`  receiver: ${ROBINHOOD_RECEIVER}`);
  console.log(`  sender:   ${STABLEGUARD}`);
  await step("setTrustedSender", () =>
    robinhoodReceiver.setTrustedSender(STABLEGUARD)
  );

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log("\n─".repeat(60));
  console.log("Verifying...");
  const [sepoliaTrusted, robinhoodTrusted] = await Promise.all([
    sepoliaReceiver.trustedSender(),
    robinhoodReceiver.trustedSender(),
  ]);
  const sepoliaOk  = sepoliaTrusted.toLowerCase()  === STABLEGUARD.toLowerCase();
  const robinhoodOk = robinhoodTrusted.toLowerCase() === STABLEGUARD.toLowerCase();
  console.log(`  Sepolia receiver  trustedSender: ${sepoliaTrusted}  ${sepoliaOk  ? "✓" : "✗"}`);
  console.log(`  Robinhood receiver trustedSender: ${robinhoodTrusted}  ${robinhoodOk ? "✓" : "✗"}`);

  if (!sepoliaOk || !robinhoodOk) throw new Error("Verification failed — check above");

  console.log("\n✓ All wiring complete. StableGuard is ready to fire CCIP alerts.");
  console.log("  Register Automation upkeep: https://automation.chain.link (Arbitrum Sepolia)");
}

main().catch(e => {
  console.error("\n✗", e.message);
  process.exitCode = 1;
});
