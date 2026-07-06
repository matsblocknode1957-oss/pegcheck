const { ethers } = require("hardhat");

const STABLEGUARD_ADDRESS = "0xff0ed8AC27dF988F2f1efbCb2719f503C9455e11";

async function main() {
  const [signer] = await ethers.getSigners();
  const network  = await ethers.provider.getNetwork();

  console.log("─".repeat(60));
  console.log("StableGuard upkeep check");
  console.log("─".repeat(60));
  console.log("Network:    ", network.name, `(chainId ${network.chainId})`);
  console.log("Contract:   ", STABLEGUARD_ADDRESS);
  console.log("Caller:     ", signer.address);
  console.log("─".repeat(60));

  const stableGuard = await ethers.getContractAt("StableGuard", STABLEGUARD_ADDRESS, signer);

  // checkUpkeep is a view — call statically
  console.log("\nCalling checkUpkeep()...");
  const [upkeepNeeded, performData] = await stableGuard.checkUpkeep("0x");
  console.log("upkeepNeeded:", upkeepNeeded);
  console.log("performData: ", performData);

  if (!upkeepNeeded) {
    console.log("\nNo upkeep needed — no depeg detected or cooldown active.");
    return;
  }

  // Decode performData: (uint8 score, string symbol, int256 clPrice, uint256 uniPrice)
  try {
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "string", "int256", "uint256"],
      performData
    );
    console.log("\nDecoded performData:");
    console.log("  score:    ", decoded[0].toString());
    console.log("  symbol:   ", decoded[1]);
    console.log("  clPrice:  ", decoded[2].toString(), "(8 decimals)");
    console.log("  uniPrice: ", decoded[3].toString(), "(8 decimals, 0 = unavailable)");
  } catch {
    console.log("\n(Could not decode performData)");
  }

  console.log("\nCalling performUpkeep()...");
  const tx = await stableGuard.performUpkeep(performData);
  console.log("Tx sent:    ", tx.hash);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("Confirmed in block", receipt.blockNumber);
  console.log("Gas used:   ", receipt.gasUsed.toString());

  // Log emitted events
  const iface = stableGuard.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      console.log(`\nEvent: ${parsed.name}`);
      for (const [key, val] of Object.entries(parsed.args)) {
        if (isNaN(Number(key))) console.log(`  ${key}: ${val.toString()}`);
      }
    } catch {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
