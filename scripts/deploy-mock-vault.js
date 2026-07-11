// Reads two env vars from .env.local:
//   PAUSER_ADDRESS    — address that can pause deposits (set to StableGuardReceiver)
//   MOCK_USDC_ADDRESS — deployed MockUSDC token address

const { ethers } = require("hardhat");

async function main() {
  const pauser = process.env.PAUSER_ADDRESS;
  const token  = process.env.MOCK_USDC_ADDRESS;

  if (!pauser) throw new Error("PAUSER_ADDRESS not set in .env.local (should be the StableGuardReceiver address on this network)");
  if (!token)  throw new Error("MOCK_USDC_ADDRESS not set in .env.local — deploy MockUSDC first");

  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);
  const network    = await ethers.provider.getNetwork();

  console.log("─".repeat(60));
  console.log("Deploying MockVault");
  console.log("─".repeat(60));
  console.log("Network:      ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer:     ", deployer.address);
  console.log("Balance:      ", ethers.formatEther(balance), "ETH");
  console.log("Pauser:       ", pauser, "(StableGuardReceiver — pause/unpause only)");
  console.log("Token (USDC): ", token);
  console.log("─".repeat(60));

  const MockVault = await ethers.getContractFactory("MockVault");
  const mockVault = await MockVault.deploy(pauser, token);
  await mockVault.waitForDeployment();

  const address = await mockVault.getAddress();
  console.log("");
  console.log("✓ MockVault deployed:", address);
  console.log("  Pauser:            ", pauser);
  console.log("  Token:             ", token);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Mint MockUSDC to a test account (MockUSDC owner only):");
  console.log(`       cast send ${token} "mint(address,uint256)" <ACCOUNT> 1000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("     (1000000000 = 1,000 USDC at 6 decimals)");
  console.log("  2. Approve MockVault to pull MockUSDC:");
  console.log(`       cast send ${token} "approve(address,uint256)" ${address} 1000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  3. Deposit into vault:");
  console.log(`       cast send ${address} "deposit(uint256)" 1000000000 --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("  4. pause()/unpause() callable by pauser address only:");
  console.log(`       cast send ${address} "pause()" --rpc-url $RPC_URL --private-key $PAUSER_PRIVATE_KEY`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
