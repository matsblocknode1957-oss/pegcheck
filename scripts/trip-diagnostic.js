// Diagnostic run: deploys an ephemeral StableGuard on Arbitrum Sepolia and a
// DiagnosticReceiver on Ethereum Sepolia (no access control), fires performUpkeep,
// then polls for the Called event to reveal the actual msg.sender inside ccipReceive.

const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const StableGuardJson    = require("../hardhat-artifacts/contracts/StableGuard.sol/StableGuard.json");
const MockAggJson        = require("../hardhat-artifacts/contracts/MockAggregatorV3.sol/MockAggregatorV3.json");
const DiagnosticJson     = require("../hardhat-artifacts/contracts/DiagnosticReceiver.sol/DiagnosticReceiver.json");

const ARB_CCIP_ROUTER = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165";
const ARB_DAI_FEED    = "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61";
const SEP_SELECTOR    = 16015286601757825753n;
const DEPEGGED_USDC   = 94_000_000n;
const FUND_AMOUNT     = ethers.parseEther("0.03");
const POLL_INTERVAL   = 30_000;
const POLL_TIMEOUT    = 25 * 60 * 1000;

async function deploy(artifact, wallet, ...args) {
  const c = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy(...args);
  await c.waitForDeployment();
  return c;
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY?.replace(/^0x/, "").replace(/^[^0-9a-fA-F]+/, "");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const arbProvider = new ethers.JsonRpcProvider(
    process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const sepProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const arbWallet   = new ethers.Wallet(pk, arbProvider);
  const sepWallet   = new ethers.Wallet(pk, sepProvider);

  console.log("─".repeat(60));
  console.log("Diagnostic: what address calls ccipReceive?");
  console.log("─".repeat(60));

  console.log("\n[1/5] Deploying MockAggregatorV3 (USDC = $0.94) on Arbitrum Sepolia...");
  const feed   = await deploy(MockAggJson, arbWallet, DEPEGGED_USDC);
  const feedAddr = await feed.getAddress();
  console.log("      ", feedAddr);

  console.log("\n[2/5] Deploying ephemeral StableGuard on Arbitrum Sepolia...");
  const sg     = await deploy(StableGuardJson, arbWallet, ARB_CCIP_ROUTER, feedAddr, ARB_DAI_FEED, ethers.ZeroAddress);
  const sgAddr = await sg.getAddress();
  console.log("      ", sgAddr);

  console.log("\n[3/5] Deploying DiagnosticReceiver on Ethereum Sepolia...");
  const diag     = await deploy(DiagnosticJson, sepWallet);
  const diagAddr = await diag.getAddress();
  console.log("      ", diagAddr);

  console.log("\n[4/5] addDestination + fund StableGuard...");
  await (await sg.addDestination(SEP_SELECTOR, diagAddr)).wait();
  await (await arbWallet.sendTransaction({ to: sgAddr, value: FUND_AMOUNT })).wait();
  console.log("      ✓ destination wired, 0.03 ETH funded");

  console.log("\n[5/5] performUpkeep...");
  const [needed] = await sg.checkUpkeep("0x");
  if (!needed) throw new Error("checkUpkeep false — mock feed not triggering");
  const tx      = await sg.performUpkeep("0x");
  const receipt = await tx.wait();
  console.log(`      source tx: ${tx.hash}`);
  console.log(`      block:     ${receipt.blockNumber}  gas: ${receipt.gasUsed}`);

  // Confirm CCIPAlertSent
  const iface = sg.interface;
  let sent = false;
  for (const log of receipt.logs) {
    try {
      const p = iface.parseLog(log);
      if (p?.name === "CCIPAlertSent") { console.log(`      CCIPAlertSent ✓  score ${p.args.confidenceScore}`); sent = true; }
      if (p?.name === "CCIPAlertFailed") throw new Error("CCIPAlertFailed");
    } catch (e) { if (e.message === "CCIPAlertFailed") throw e; }
  }
  if (!sent) throw new Error("No CCIPAlertSent");

  // Poll DiagnosticReceiver state via view calls (avoids getLogs range limits)
  console.log("\nPolling DiagnosticReceiver.called() every 30s (25 min max)...");
  console.log(`Receiver: ${diagAddr}\n`);

  const diagContract = new ethers.Contract(diagAddr, DiagnosticJson.abi, sepProvider);
  const start    = Date.now();
  const deadline = start + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const elapsed = Math.round((Date.now() - start) / 1000);
    const wasCalled = await diagContract.called();
    process.stdout.write(`\r[${String(elapsed).padStart(4)}s]  called = ${wasCalled}   `);

    if (wasCalled) {
      const [lastCaller, lastMsgId, lastSelector, lastSender, lastData] = await Promise.all([
        diagContract.lastCaller(),
        diagContract.lastMessageId(),
        diagContract.lastSourceChainSelector(),
        diagContract.lastSender(),
        diagContract.lastData(),
      ]);
      console.log("\n\n" + "─".repeat(60));
      console.log("ccipReceive was called!");
      console.log("─".repeat(60));
      console.log("msg.sender (caller):       ", lastCaller);
      console.log("messageId:                 ", lastMsgId);
      console.log("sourceChainSelector:       ", lastSelector.toString());
      console.log("sender (bytes):            ", lastSender);
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address"], lastSender)[0];
        console.log("sender decoded as address: ", decoded);
      } catch { console.log("sender decode failed — not standard abi.encode(address)"); }
      console.log("data (hex):                ", lastData);
      console.log("─".repeat(60));
      console.log("\n→ Use the caller address above as ccipRouter in StableGuardReceiver.");
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error("Timed out — ccipReceive never called. CCIP may still be in flight.");
}

main().catch((err) => { console.error("\n✗", err.message); process.exitCode = 1; });
