const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);
  const network    = await ethers.provider.getNetwork();

  console.log("─".repeat(60));
  console.log("Deploying MockUSDC");
  console.log("─".repeat(60));
  console.log("Network:  ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(balance), "ETH");
  console.log("Owner:     deployer (mint restricted to owner)");
  console.log("─".repeat(60));

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();

  const address = await mockUSDC.getAddress();
  console.log("");
  console.log("✓ MockUSDC deployed:", address);
  console.log("  Owner:            ", deployer.address);
  console.log("");
  console.log("Next steps:");
  console.log("  Mint tokens to an address (owner only):");
  console.log(`    cast send ${address} "mint(address,uint256)" <TO> <AMOUNT> --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  1000000000 = 1,000 USDC at 6 decimals");
  console.log("");
  console.log("  Set in .env.local before deploying MockVault:");
  console.log(`    MOCK_USDC_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
