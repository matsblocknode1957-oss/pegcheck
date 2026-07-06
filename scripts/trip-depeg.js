const { ethers } = require("hardhat");

// ── Arbitrum Sepolia constants ────────────────────────────────────────────────
const CCIP_ROUTER                = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165";
const DAI_USD_FEED               = "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61";
const DESTINATION_CHAIN_SELECTOR = 16015286601757825753n; // → Ethereum Sepolia

// Simulated USDC depeg: $0.94 (6% below peg — well past the 50 bps threshold)
const DEPEGGED_USDC_PRICE = 94_000_000n; // 8 decimals

async function main() {
  const [signer] = await ethers.getSigners();
  const network  = await ethers.provider.getNetwork();
  const ccipReceiver = process.env.CCIP_RECEIVER_ADDRESS ?? ethers.ZeroAddress;

  console.log("─".repeat(60));
  console.log("Depeg trip test — mock feed + ephemeral StableGuard");
  console.log("─".repeat(60));
  console.log("Network:    ", network.name, `(chainId ${network.chainId})`);
  console.log("Signer:     ", signer.address);
  console.log("CCIP dest:  ", ccipReceiver);
  console.log("Mock price: ", DEPEGGED_USDC_PRICE.toString(), "($0.94 — 6% depeg)");
  console.log("─".repeat(60));

  // ── 1. Deploy mock USDC/USD feed returning $0.94 ─────────────────────────
  console.log("\n[1/5] Deploying MockAggregatorV3 (USDC/USD = $0.94)...");
  const MockAgg  = await ethers.getContractFactory("MockAggregatorV3");
  const mockFeed = await MockAgg.deploy(DEPEGGED_USDC_PRICE);
  await mockFeed.waitForDeployment();
  const mockFeedAddress = await mockFeed.getAddress();
  console.log("      Mock feed:", mockFeedAddress);

  // ── 2. Deploy test StableGuard pointing at the mock USDC feed ────────────
  console.log("\n[2/5] Deploying test StableGuard (mock USDC feed, real DAI feed)...");
  const StableGuard = await ethers.getContractFactory("StableGuard");
  const sg          = await StableGuard.deploy(
    CCIP_ROUTER,
    mockFeedAddress,    // ← depegged mock
    DAI_USD_FEED,       // real DAI feed (no depeg expected)
    DESTINATION_CHAIN_SELECTOR,
    ccipReceiver,
    ethers.ZeroAddress, // no Uniswap pool — score will be 3 (Chainlink only)
  );
  await sg.waitForDeployment();
  const sgAddress = await sg.getAddress();
  console.log("      StableGuard:", sgAddress);

  // ── 3. Fund with ETH to cover the CCIP fee ───────────────────────────────
  console.log("\n[3/5] Funding StableGuard with 0.01 ETH for CCIP fee...");
  const fundTx = await signer.sendTransaction({
    to:    sgAddress,
    value: ethers.parseEther("0.01"),
  });
  await fundTx.wait();
  console.log("      Funded. Balance:", ethers.formatEther(
    await ethers.provider.getBalance(sgAddress)
  ), "ETH");

  // ── 4. checkUpkeep ────────────────────────────────────────────────────────
  console.log("\n[4/5] Calling checkUpkeep()...");
  const [upkeepNeeded, performData] = await sg.checkUpkeep("0x");
  console.log("      upkeepNeeded:", upkeepNeeded);

  if (!upkeepNeeded) {
    console.log("\n      ERROR: depeg not detected — check mock feed price.");
    return;
  }

  try {
    const dec = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "string", "int256", "uint256"],
      performData,
    );
    console.log("      Decoded performData:");
    console.log("        score:   ", dec[0].toString());
    console.log("        symbol:  ", dec[1]);
    console.log("        clPrice: ", dec[2].toString(), "(8 dec =", (Number(dec[2]) / 1e8).toFixed(6), "USD)");
    console.log("        uniPrice:", dec[3].toString(), dec[3] === 0n ? "(DEX unavailable)" : "");
  } catch {
    console.log("      (could not decode performData)");
  }

  // ── 5. performUpkeep ─────────────────────────────────────────────────────
  console.log("\n[5/5] Calling performUpkeep()...");
  const tx      = await sg.performUpkeep(performData);
  console.log("      Tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("      Confirmed in block", receipt.blockNumber);
  console.log("      Gas used:", receipt.gasUsed.toString());

  // ── Parse and print all emitted events ───────────────────────────────────
  const iface = sg.interface;
  let eventCount = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      eventCount++;
      console.log(`\n      Event [${eventCount}]: ${parsed.name}`);
      for (const [key, val] of Object.entries(parsed.args)) {
        if (isNaN(Number(key))) {
          console.log(`        ${key}: ${val.toString()}`);
        }
      }
    } catch {}
  }
  if (eventCount === 0) console.log("\n      (no events parsed)");

  console.log("\n" + "─".repeat(60));
  console.log("Test complete.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
