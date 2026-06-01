import { ethers } from "hardhat";

const STABLE_GUARD    = "0x44930ef915b30CbA75C0B94d62cE516d7900d27C";
const RECEIVER        = "0x55b1Bd1BB21B1e258Dd616929225d21E96553D05";
const FUND_AMOUNT_ETH = "0.1";

const RECEIVER_ABI = [
  "function setTrustedSender(address _sender) external",
  "function trustedSender() external view returns (address)",
  "function owner() external view returns (address)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Wiring up StableGuard on Sepolia");
  console.log("─".repeat(60));
  console.log("Deployer:    ", deployer.address);
  console.log("Balance:     ", ethers.formatEther(balance), "ETH");
  console.log("StableGuard: ", STABLE_GUARD);
  console.log("Receiver:    ", RECEIVER);
  console.log("─".repeat(60));

  const receiver = new ethers.Contract(RECEIVER, RECEIVER_ABI, deployer);

  // ── Step 1: setTrustedSender ────────────────────────────
  console.log("\n[1/2] Calling setTrustedSender on StableGuardReceiver...");
  const currentSender = await receiver.trustedSender();
  if (currentSender.toLowerCase() === STABLE_GUARD.toLowerCase()) {
    console.log("      Already set — skipping.");
  } else {
    const tx1 = await receiver.setTrustedSender(STABLE_GUARD);
    console.log("      tx:", tx1.hash);
    await tx1.wait();
    console.log("      ✓ trustedSender set to", STABLE_GUARD);
  }

  // ── Step 2: Fund StableGuard with 0.1 ETH ───────────────
  console.log("\n[2/2] Funding StableGuard with", FUND_AMOUNT_ETH, "ETH for CCIP fees...");
  const contractBalance = await ethers.provider.getBalance(STABLE_GUARD);
  console.log("      Current contract balance:", ethers.formatEther(contractBalance), "ETH");
  const tx2 = await deployer.sendTransaction({
    to:    STABLE_GUARD,
    value: ethers.parseEther(FUND_AMOUNT_ETH),
  });
  console.log("      tx:", tx2.hash);
  await tx2.wait();
  const newBalance = await ethers.provider.getBalance(STABLE_GUARD);
  console.log("      ✓ Contract balance now:", ethers.formatEther(newBalance), "ETH");

  console.log("\n─".repeat(60));
  console.log("✓ Wiring complete.");
  console.log("");
  console.log("Final step — register Automation upkeep manually:");
  console.log("  https://automation.chain.link");
  console.log("  Network:          Ethereum Sepolia");
  console.log("  Trigger type:     Time-based (every 60 seconds)");
  console.log("  Contract address:", STABLE_GUARD);
  console.log("  ABI function:     checkUpkeep (bytes)");
  console.log("  Gas limit:        500000");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
