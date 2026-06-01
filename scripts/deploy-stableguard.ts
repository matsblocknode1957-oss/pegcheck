import { ethers } from "hardhat";

// ── CCIP destination chain selector ───────────────────────────────────────────
// Default: Avalanche Fuji (14767482510784806043) — a reliable CCIP testnet target.
// Override by setting DESTINATION_CHAIN_SELECTOR in .env.
// Full selector list: https://docs.chain.link/ccip/supported-networks
const DESTINATION_CHAIN_SELECTOR: bigint = process.env.DESTINATION_CHAIN_SELECTOR
  ? BigInt(process.env.DESTINATION_CHAIN_SELECTOR)
  : 14767482510784806043n;

// Address of StableGuardReceiver on the destination chain.
// Deploy that contract first, then set CCIP_RECEIVER_ADDRESS in .env.
// Defaults to zero address so StableGuard can be deployed independently.
const CCIP_RECEIVER: string =
  process.env.CCIP_RECEIVER_ADDRESS ?? ethers.ZeroAddress;

// Uniswap V3 USDC/USDT pool on Sepolia.
// Set UNISWAP_POOL_ADDRESS in .env if a pool with liquidity exists.
// Zero address disables the DEX cross-check (confidence cap = 3).
const UNISWAP_POOL: string =
  process.env.UNISWAP_POOL_ADDRESS ?? ethers.ZeroAddress;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Deploying StableGuard to Sepolia");
  console.log("─".repeat(60));
  console.log("Deployer:              ", deployer.address);
  console.log("Balance:               ", ethers.formatEther(balance), "ETH");
  console.log("Destination selector:  ", DESTINATION_CHAIN_SELECTOR.toString());
  console.log("CCIP receiver:         ", CCIP_RECEIVER);
  console.log("Uniswap pool:          ", UNISWAP_POOL);
  console.log("─".repeat(60));

  const StableGuard = await ethers.getContractFactory("StableGuard");
  const stableGuard = await StableGuard.deploy(
    DESTINATION_CHAIN_SELECTOR,
    CCIP_RECEIVER,
    UNISWAP_POOL,
  );

  console.log("Waiting for deployment...");
  await stableGuard.waitForDeployment();

  const address = await stableGuard.getAddress();
  console.log("");
  console.log("✓ StableGuard deployed:", address);
  console.log("  Etherscan:           ", `https://sepolia.etherscan.io/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fund with ETH for CCIP fees:");
  console.log(`       cast send ${address} --value 0.1ether --rpc-url $ALCHEMY_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  2. Register Automation upkeep:");
  console.log("       https://automation.chain.link (use contract address above)");
  console.log("  3. Deploy StableGuardReceiver on the destination chain,");
  console.log("     then call setReceiver(<receiverAddress>) on this contract.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
