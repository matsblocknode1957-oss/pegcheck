// End-to-end vault pause test.
//
// Hits two networks in one run:
//   Arbitrum Sepolia — deploy mock feed + ephemeral StableGuard, call performUpkeep
//   Ethereum Sepolia — deploy ephemeral receiver + fresh MockVault, poll for pause
//
// The ephemeral receiver trusts only the ephemeral StableGuard, so the existing
// production contracts are untouched. A fresh MockVault is deployed with the
// ephemeral receiver as pauser (pauser is immutable, can't reuse the existing one).

const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const StableGuardJson = require("../hardhat-artifacts/contracts/StableGuard.sol/StableGuard.json");
const ReceiverJson    = require("../hardhat-artifacts/contracts/StableGuard.sol/StableGuardReceiver.json");
const MockAggJson     = require("../hardhat-artifacts/contracts/MockAggregatorV3.sol/MockAggregatorV3.json");
const MockVaultJson   = require("../hardhat-artifacts/contracts/MockVault.sol/MockVault.json");

// ── Arbitrum Sepolia ──────────────────────────────────────────────────────────
const ARB_CCIP_ROUTER = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165";
const ARB_DAI_FEED    = "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61";
const ARB_SELECTOR    = 3478487238524512106n;

// ── Ethereum Sepolia ──────────────────────────────────────────────────────────
const SEP_CCIP_ROUTER = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"; // Ethereum Sepolia CCIP Router
const SEP_SELECTOR    = 16015286601757825753n;
const MOCK_USDC       = "0xcc502cE476D999f79b27bD1D45b7BD42564B05E7"; // existing MockUSDC on Sepolia

const DEPEGGED_USDC   = 94_000_000n;           // $0.94 — 8 decimals
const FUND_AMOUNT     = ethers.parseEther("0.03");
const POLL_INTERVAL   = 30_000;                // 30 s
const POLL_TIMEOUT    = 25 * 60 * 1000;        // 25 min

async function deployContract(artifact, wallet, ...args) {
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY
    ?.replace(/^0x/, "")
    .replace(/^[^0-9a-fA-F]+/, "");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  const arbProvider = new ethers.JsonRpcProvider(
    process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const sepProvider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/J55OLMq9Jt9zmd6GcP0MO"
  );
  const arbWallet = new ethers.Wallet(pk, arbProvider);
  const sepWallet = new ethers.Wallet(pk, sepProvider);

  console.log("─".repeat(60));
  console.log("End-to-end vault pause test");
  console.log("Ephemeral StableGuard → CCIP → ephemeral receiver → MockVault.pause()");
  console.log("─".repeat(60));
  console.log("Deployer:", arbWallet.address);
  console.log("─".repeat(60));

  // ── 1. Deploy MockAggregatorV3 on Arbitrum Sepolia ────────────────────────
  console.log("\n[1/8] Deploying MockAggregatorV3 (USDC = $0.94) on Arbitrum Sepolia...");
  const mockFeed    = await deployContract(MockAggJson, arbWallet, DEPEGGED_USDC);
  const mockFeedAddr = await mockFeed.getAddress();
  console.log("      ", mockFeedAddr);

  // ── 2. Deploy ephemeral StableGuard on Arbitrum Sepolia ──────────────────
  console.log("\n[2/8] Deploying ephemeral StableGuard on Arbitrum Sepolia...");
  const sg      = await deployContract(StableGuardJson, arbWallet,
    ARB_CCIP_ROUTER, mockFeedAddr, ARB_DAI_FEED, ethers.ZeroAddress,
  );
  const sgAddr  = await sg.getAddress();
  console.log("      ", sgAddr);

  // ── 3. Deploy ephemeral StableGuardReceiver on Ethereum Sepolia ──────────
  console.log("\n[3/8] Deploying ephemeral StableGuardReceiver on Ethereum Sepolia...");
  const receiver     = await deployContract(ReceiverJson, sepWallet,
    SEP_CCIP_ROUTER,
    sgAddr,        // trustedSender = ephemeral StableGuard
    ARB_SELECTOR,  // sourceChainSelector = Arbitrum Sepolia
  );
  const receiverAddr = await receiver.getAddress();
  console.log("      ", receiverAddr);

  // ── 4. Deploy fresh MockVault on Ethereum Sepolia ─────────────────────────
  console.log("\n[4/8] Deploying fresh MockVault on Ethereum Sepolia...");
  const vault     = await deployContract(MockVaultJson, sepWallet,
    receiverAddr,  // pauser = ephemeral receiver (immutable — must be set at deploy time)
    MOCK_USDC,
  );
  const vaultAddr = await vault.getAddress();
  console.log("      ", vaultAddr);

  // ── 5. Wire vault into receiver ────────────────────────────────────────────
  console.log("\n[5/8] setVault on ephemeral receiver...");
  await (await receiver.setVault(vaultAddr)).wait();
  console.log("      ✓ vault =", vaultAddr);

  // ── 6. addDestination + fund StableGuard ──────────────────────────────────
  console.log("\n[6/8] addDestination(Ethereum Sepolia) + fund 0.03 ETH...");
  await (await sg.addDestination(SEP_SELECTOR, receiverAddr)).wait();
  await (await arbWallet.sendTransaction({ to: sgAddr, value: FUND_AMOUNT })).wait();
  console.log("      ✓ destination wired, 0.03 ETH funded");

  // ── 7. checkUpkeep → performUpkeep ────────────────────────────────────────
  console.log("\n[7/8] checkUpkeep...");
  const [upkeepNeeded] = await sg.checkUpkeep("0x");
  if (!upkeepNeeded) throw new Error("checkUpkeep returned false — mock feed not triggering depeg");
  console.log("      upkeepNeeded: true ✓");

  console.log("      performUpkeep...");
  const tx      = await sg.performUpkeep("0x");
  const receipt = await tx.wait();
  console.log(`      tx:    ${tx.hash}`);
  console.log(`      block: ${receipt.blockNumber}  gas: ${receipt.gasUsed}`);

  const iface = sg.interface;
  let ccipSent = false;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === "CCIPAlertSent") {
        console.log(`      CCIPAlertSent ✓  selector ${parsed.args.destinationChainSelector}  score ${parsed.args.confidenceScore}`);
        ccipSent = true;
      }
      if (parsed.name === "CCIPAlertFailed") {
        throw new Error(`CCIPAlertFailed on selector ${parsed.args.destinationChainSelector}`);
      }
    } catch (e) {
      if (e.message.startsWith("CCIPAlertFailed")) throw e;
    }
  }
  if (!ccipSent) throw new Error("No CCIPAlertSent event found in receipt");

  // ── 8. Poll MockVault.paused() on Ethereum Sepolia ────────────────────────
  console.log("\n[8/8] Polling MockVault.paused() on Ethereum Sepolia...");
  console.log(`      Vault:    ${vaultAddr}`);
  console.log(`      Receiver: ${receiverAddr}`);
  console.log("      CCIP delivery is typically 10–20 min on testnet. Polling every 30s.");
  console.log("      Timeout: 25 minutes.\n");

  const start    = Date.now();
  const deadline = start + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const paused  = await vault.paused();
    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`\r      [${String(elapsed).padStart(4)}s elapsed]  paused = ${paused}   `);

    if (paused) {
      console.log("\n");
      console.log("─".repeat(60));
      console.log("✓ MockVault.paused() = true — end-to-end vault pause proved.");
      console.log("  Source tx (Arb Sepolia):", tx.hash);
      console.log("  Vault (Eth Sepolia):    ", vaultAddr);
      console.log("  Receiver (Eth Sepolia): ", receiverAddr);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.log("");
  throw new Error(
    "Timed out after 25 minutes. CCIP delivery may still be in flight.\n" +
    `Check manually: cast call ${vaultAddr} "paused()(bool)" --rpc-url $SEPOLIA_RPC_URL`
  );
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exitCode = 1;
});
