const { ethers } = require("hardhat");

// ── Robinhood Chain testnet network addresses ────────────────────────────────
// CCIP Router: https://docs.chain.link/ccip/directory/testnet/chain/robinhood-testnet
const CCIP_ROUTER = "0x30D197C6F5bE050D5525dD94d01760FaCdB67e7C";

// StableGuard on Arbitrum Sepolia — the contract authorised to send alerts here.
const TRUSTED_SENDER = "0xff0ed8AC27dF988F2f1efbCb2719f503C9455e11";

// CCIP chain selector for Arbitrum Sepolia (the source chain).
// https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#arbitrum-testnet-sepolia
const SOURCE_CHAIN_SELECTOR = 3478487238524512106n;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Deploying StableGuardReceiver to Robinhood Chain testnet");
  console.log("─".repeat(60));
  console.log("Deployer:              ", deployer.address);
  console.log("Balance:               ", ethers.formatEther(balance), "ETH");
  console.log("CCIP Router:           ", CCIP_ROUTER);
  console.log("Trusted sender:        ", TRUSTED_SENDER, "(Arbitrum Sepolia StableGuard)");
  console.log("Source chain selector: ", SOURCE_CHAIN_SELECTOR.toString(), "(Arbitrum Sepolia)");
  console.log("─".repeat(60));

  const Receiver = await ethers.getContractFactory("StableGuardReceiver");
  const receiver = await Receiver.deploy(CCIP_ROUTER, TRUSTED_SENDER, SOURCE_CHAIN_SELECTOR);

  console.log("Waiting for deployment...");
  await receiver.waitForDeployment();

  const address = await receiver.getAddress();
  console.log("");
  console.log("✓ StableGuardReceiver deployed:", address);
  console.log("  Explorer:                    ", `https://explorer.testnet.chain.robinhood.com/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Point the Arbitrum Sepolia StableGuard at this receiver:");
  console.log(`       cast send 0xff0ed8AC27dF988F2f1efbCb2719f503C9455e11 "setDestinationChain(uint64)" 2032988798112970440 --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log(`       cast send 0xff0ed8AC27dF988F2f1efbCb2719f503C9455e11 "setReceiver(address)" ${address} --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  2. Authorise the Arbitrum Sepolia StableGuard as trusted sender on the Robinhood receiver");
  console.log("     (already set in constructor — verify on explorer if needed)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
