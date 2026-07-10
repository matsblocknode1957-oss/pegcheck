const { ethers } = require("hardhat");

// ── Arbitrum Sepolia network addresses ───────────────────────────────────────
// CCIP Router: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#arbitrum-testnet-sepolia
const CCIP_ROUTER   = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165";
// Price feeds: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum&page=1#arbitrum-sepolia-testnet
const USDC_USD_FEED = "0x0153002d20B96532C639313c2d54c3dA09109309";
const DAI_USD_FEED  = "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61";

// No Uniswap V3 pool configured for now — DEX cross-check disabled (confidence cap = 3).
// Set UNISWAP_POOL_ADDRESS in .env.local to enable when a pool with liquidity exists.
const UNISWAP_POOL =
  process.env.UNISWAP_POOL_ADDRESS ?? ethers.ZeroAddress;

// ── CCIP destinations (added post-deploy via addDestination()) ───────────────
// Ethereum Sepolia receiver:  0x4E22DcAa7abc7701144b737827613A99343beD3d  (selector 16015286601757825753)
// Robinhood Chain receiver:   0x6381383Ff70434A7681Bc329D89b3a7AC17129A8  (selector 2032988798112970440)

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
  console.log("Uniswap pool:          ", UNISWAP_POOL, "(disabled)");
  console.log("CCIP destinations:      added post-deploy via addDestination()");
  console.log("─".repeat(60));

  const StableGuard = await ethers.getContractFactory("StableGuard");
  const stableGuard = await StableGuard.deploy(
    CCIP_ROUTER,
    USDC_USD_FEED,
    DAI_USD_FEED,
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
  console.log("  1. Fund with ETH for CCIP fees (covers both destinations):");
  console.log(`       cast send ${address} --value 0.1ether --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  2. Add Ethereum Sepolia as destination (selector 16015286601757825753):");
  console.log(`       cast send ${address} "addDestination(uint64,address)" 16015286601757825753 0x4E22DcAa7abc7701144b737827613A99343beD3d --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  3. Add Robinhood Chain as destination (selector 2032988798112970440):");
  console.log(`       cast send ${address} "addDestination(uint64,address)" 2032988798112970440 0x6381383Ff70434A7681Bc329D89b3a7AC17129A8 --rpc-url $ARB_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  4. Authorise this contract as trusted sender on each receiver:");
  console.log(`       cast send 0x4E22DcAa7abc7701144b737827613A99343beD3d "setTrustedSender(address)" ${address} --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log(`       cast send 0x6381383Ff70434A7681Bc329D89b3a7AC17129A8 "setTrustedSender(address)" ${address} --rpc-url $ROBINHOOD_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  5. Register Automation upkeep:");
  console.log("       https://automation.chain.link (switch to Arbitrum Sepolia)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
