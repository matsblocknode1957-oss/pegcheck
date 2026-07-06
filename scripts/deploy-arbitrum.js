const { ethers } = require("hardhat");

// ── Arbitrum Sepolia network addresses ───────────────────────────────────────
// CCIP Router: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#arbitrum-testnet-sepolia
const CCIP_ROUTER   = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165";
// Price feeds: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum&page=1#arbitrum-sepolia-testnet
const USDC_USD_FEED = "0x0153002d20B96532C639313c2d54c3dA09109309";
const DAI_USD_FEED  = "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61";

// ── CCIP destination: Ethereum Sepolia ───────────────────────────────────────
// Chain selector: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#ethereum-testnet-sepolia
const DESTINATION_CHAIN_SELECTOR = 16015286601757825753n;

// Address of StableGuardReceiver deployed on Ethereum Sepolia.
// Run scripts/deploy-receiver.ts --network sepolia first if not yet deployed,
// then set CCIP_RECEIVER_ADDRESS in .env.local.
const CCIP_RECEIVER =
  process.env.CCIP_RECEIVER_ADDRESS ?? ethers.ZeroAddress;

// No Uniswap V3 pool configured for now — DEX cross-check disabled (confidence cap = 3).
// Set UNISWAP_POOL_ADDRESS in .env.local to enable when a pool with liquidity exists.
const UNISWAP_POOL =
  process.env.UNISWAP_POOL_ADDRESS ?? ethers.ZeroAddress;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Deploying StableGuard to Arbitrum Sepolia");
  console.log("─".repeat(60));
  console.log("Deployer:              ", deployer.address);
  console.log("Balance:               ", ethers.formatEther(balance), "ETH");
  console.log("CCIP Router:           ", CCIP_ROUTER);
  console.log("USDC/USD feed:         ", USDC_USD_FEED);
  console.log("DAI/USD feed:          ", DAI_USD_FEED);
  console.log("Destination selector:  ", DESTINATION_CHAIN_SELECTOR.toString(), "(Ethereum Sepolia)");
  console.log("CCIP receiver:         ", CCIP_RECEIVER, CCIP_RECEIVER === ethers.ZeroAddress ? "(update via setReceiver after deploying receiver)" : "");
  console.log("Uniswap pool:          ", UNISWAP_POOL, "(disabled)");
  console.log("─".repeat(60));

  if (CCIP_RECEIVER === ethers.ZeroAddress) {
    console.log("⚠  CCIP_RECEIVER_ADDRESS not set — deploying with zero address.");
    console.log("   Run scripts/deploy-receiver.ts --network sepolia first,");
    console.log("   then call setReceiver(<address>) on this contract.\n");
  }

  const StableGuard = await ethers.getContractFactory("StableGuard");
  const stableGuard = await StableGuard.deploy(
    CCIP_ROUTER,
    USDC_USD_FEED,
    DAI_USD_FEED,
    DESTINATION_CHAIN_SELECTOR,
    CCIP_RECEIVER,
    UNISWAP_POOL,
  );

  console.log("Waiting for deployment...");
  await stableGuard.waitForDeployment();

  const address = await stableGuard.getAddress();
  console.log("");
  console.log("✓ StableGuard deployed:", address);
  console.log("  Arbiscan:            ", `https://sepolia.arbiscan.io/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fund with ETH for CCIP fees:");
  console.log(`       cast send ${address} --value 0.05ether --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  2. If receiver not yet set, deploy it on Sepolia then:");
  console.log(`       cast send ${address} "setReceiver(address)" <receiver_address> --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  3. On the Sepolia receiver, authorise this contract as trusted sender:");
  console.log(`       cast send <receiver_address> "setTrustedSender(address)" ${address} --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  4. Register Automation upkeep:");
  console.log("       https://automation.chain.link (switch to Arbitrum Sepolia)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
