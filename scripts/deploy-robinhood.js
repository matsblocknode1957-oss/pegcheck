const { ethers } = require("hardhat");

// ── Robinhood Chain testnet network addresses ────────────────────────────────
// CCIP Router: https://docs.chain.link/ccip/directory/testnet/chain/robinhood-testnet
const CCIP_ROUTER = "0x30D197C6F5bE050D5525dD94d01760FaCdB67e7C";

// Chainlink price feeds are not yet publicly listed for Robinhood Chain testnet.
// See https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood
// Set ROBINHOOD_USDC_USD_FEED / ROBINHOOD_DAI_USD_FEED in .env.local when available.
// Zero address disables each feed — _getChainlinkPrice try/catch handles this gracefully.
const USDC_USD_FEED =
  process.env.ROBINHOOD_USDC_USD_FEED ?? ethers.ZeroAddress;
const DAI_USD_FEED =
  process.env.ROBINHOOD_DAI_USD_FEED ?? ethers.ZeroAddress;

// No Uniswap V3 pool on Robinhood Chain testnet — DEX cross-check disabled.
const UNISWAP_POOL = ethers.ZeroAddress;

// ── CCIP destinations (added post-deploy via addDestination()) ───────────────
// Add destinations after deployment using the cast commands in Next steps below.

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Deploying StableGuard to Robinhood Chain testnet");
  console.log("─".repeat(60));
  console.log("Deployer:              ", deployer.address);
  console.log("Balance:               ", ethers.formatEther(balance), "ETH");
  console.log("CCIP Router:           ", CCIP_ROUTER);
  console.log("USDC/USD feed:         ", USDC_USD_FEED, USDC_USD_FEED === ethers.ZeroAddress ? "(not yet available — feed disabled)" : "");
  console.log("DAI/USD feed:          ", DAI_USD_FEED,  DAI_USD_FEED  === ethers.ZeroAddress ? "(not yet available — feed disabled)" : "");
  console.log("Uniswap pool:          ", UNISWAP_POOL, "(disabled)");
  console.log("CCIP destinations:      added post-deploy via addDestination()");
  console.log("─".repeat(60));

  if (USDC_USD_FEED === ethers.ZeroAddress && DAI_USD_FEED === ethers.ZeroAddress) {
    console.log("⚠  Both price feeds are zero address — depeg detection disabled until");
    console.log("   Chainlink publishes feed addresses for Robinhood Chain testnet.");
    console.log("   Set ROBINHOOD_USDC_USD_FEED / ROBINHOOD_DAI_USD_FEED in .env.local,");
    console.log("   then call setUsdcFeed / setDaiFeed on the deployed contract.\n");
  }

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
  console.log("  Explorer:            ", `https://explorer.testnet.chain.robinhood.com/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fund with ETH for CCIP fees:");
  console.log(`       cast send ${address} --value 0.05ether --rpc-url $ROBINHOOD_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  2. Add destinations via addDestination() — e.g. Ethereum Sepolia:");
  console.log(`       cast send ${address} "addDestination(uint64,address)" 16015286601757825753 0x4E22DcAa7abc7701144b737827613A99343beD3d --rpc-url $ROBINHOOD_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  3. Authorise this contract as trusted sender on each receiver:");
  console.log(`       cast send 0x4E22DcAa7abc7701144b737827613A99343beD3d "setTrustedSender(address)" ${address} --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  4. When Chainlink publishes feed addresses for Robinhood testnet, enable them:");
  console.log(`       cast send ${address} "setUsdcFeed(address)" <feed> --rpc-url $ROBINHOOD_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  5. Register Automation upkeep (once feeds are live):");
  console.log("       https://automation.chain.link (switch to Robinhood Chain testnet)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
