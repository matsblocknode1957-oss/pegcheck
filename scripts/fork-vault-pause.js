// Fork test: impersonate the Ethereum Sepolia CCIP Router and call ccipReceive
// directly on a fresh receiver + vault pair, proving vault.paused() flips to true
// without waiting for live CCIP delivery.
//
// Run with:
//   npx hardhat run scripts/fork-vault-pause.js
// (uses the Hardhat in-memory network, forked from Ethereum Sepolia at runtime)

const hre    = require("hardhat");
const ethers = hre.ethers;

const CCIP_ROUTER       = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"; // Eth Sepolia CCIP Router
const ARB_SELECTOR      = 3478487238524512106n;                          // Arbitrum Sepolia chain selector
const SEPOLIA_RPC_URL   = process.env.SEPOLIA_RPC_URL;

async function main() {
  // ── 0. Fork Ethereum Sepolia ──────────────────────────────────────────────
  console.log("─".repeat(60));
  console.log("Fork test: impersonate CCIP Router → ccipReceive → vault.pause()");
  console.log("─".repeat(60));

  if (!SEPOLIA_RPC_URL) throw new Error("SEPOLIA_RPC_URL not set in .env.local");

  console.log("\n[0/6] Forking Ethereum Sepolia...");
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [{ forking: { jsonRpcUrl: SEPOLIA_RPC_URL } }],
  });
  console.log("      ✓ fork ready");

  const [deployer] = await ethers.getSigners();
  console.log("      deployer:", deployer.address);

  // ── 1. Deploy MockVault (pauser = receiver — set after deploy, so temp address first)
  //       We'll use a two-step deploy: vault first with deployer as pauser, then
  //       re-deploy with the real receiver. Actually: deploy receiver first, then vault.
  //
  //  Order: receiver first (needs no vault), vault second (needs receiver as pauser),
  //         then setVault on receiver.

  // ── 1. Deploy StableGuardReceiver ─────────────────────────────────────────
  console.log("\n[1/6] Deploying StableGuardReceiver...");
  const TRUSTED_SENDER = deployer.address; // we'll use deployer as trustedSender for simplicity
  const Receiver = await ethers.getContractFactory("StableGuardReceiver");
  const receiver = await Receiver.deploy(CCIP_ROUTER, TRUSTED_SENDER, ARB_SELECTOR);
  await receiver.waitForDeployment();
  const receiverAddr = await receiver.getAddress();
  console.log("      ", receiverAddr);
  console.log("      ccipRouter:    ", CCIP_ROUTER);
  console.log("      trustedSender: ", TRUSTED_SENDER);

  // ── 2. Deploy MockUSDC (needed by MockVault constructor) ──────────────────
  console.log("\n[2/6] Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc     = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("      ", usdcAddr);

  // ── 3. Deploy MockVault (pauser = receiver) ───────────────────────────────
  console.log("\n[3/6] Deploying MockVault (pauser = receiver)...");
  const MockVault = await ethers.getContractFactory("MockVault");
  const vault     = await MockVault.deploy(receiverAddr, usdcAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("      ", vaultAddr);
  console.log("      pauser: ", receiverAddr, "(receiver)");

  // ── 4. Wire vault into receiver ───────────────────────────────────────────
  console.log("\n[4/6] receiver.setVault(vault)...");
  await (await receiver.setVault(vaultAddr)).wait();
  console.log("      ✓ vault =", vaultAddr);

  // ── 5. Impersonate CCIP Router and call ccipReceive ───────────────────────
  console.log("\n[5/6] Impersonating CCIP Router and calling ccipReceive...");
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [CCIP_ROUTER],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    CCIP_ROUTER,
    "0x" + (10n ** 18n).toString(16), // 1 ETH for gas
  ]);

  const routerSigner = await ethers.getSigner(CCIP_ROUTER);

  // Construct the Any2EVMMessage exactly as StableGuard._sendCCIPAlert encodes it:
  //   data    = abi.encode(symbol, score, block.timestamp)
  //   sender  = abi.encode(trustedSender)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const payload  = abiCoder.encode(
    ["string", "uint8",  "uint256"],
    ["USDC",   3,        Math.floor(Date.now() / 1000)]
  );
  const senderBytes = abiCoder.encode(["address"], [TRUSTED_SENDER]);

  // Any2EVMMessage struct (matches StableGuard.sol definition)
  const message = {
    messageId:           ethers.id("fork-test-message-id"), // arbitrary bytes32
    sourceChainSelector: ARB_SELECTOR,
    sender:              senderBytes,
    data:                payload,
    tokenAmounts:        [],
  };

  const tx      = await receiver.connect(routerSigner).ccipReceive(message);
  const receipt = await tx.wait();
  console.log("      tx:", tx.hash);
  console.log("      gas used:", receipt.gasUsed.toString());

  // Check for events
  const iface = receiver.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed) console.log(`      event: ${parsed.name}(${Object.values(parsed.args).join(", ")})`);
    } catch {}
  }

  // ── 6. Verify vault.paused() ─────────────────────────────────────────────
  console.log("\n[6/6] Checking vault.paused()...");
  const paused = await vault.paused();
  console.log("      vault.paused():", paused);

  console.log("\n" + "─".repeat(60));
  if (paused) {
    console.log("✓ PASS — vault.paused() = true");
    console.log("  ccipReceive → vault.pause() chain works end-to-end.");
    console.log("  The only remaining dependency is live CCIP delivery.");
  } else {
    throw new Error("FAIL — vault.paused() = false after ccipReceive. Check events above.");
  }
  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exitCode = 1;
});
