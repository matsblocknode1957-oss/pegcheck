import { ethers } from "hardhat";

// CCIP Router on Ethereum Sepolia
// https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet#ethereum-testnet-sepolia
const CCIP_ROUTER_SEPOLIA = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";

// trustedSender = StableGuard address on Sepolia (not yet deployed).
// Defaults to zero address — call setTrustedSender(<StableGuard address>)
// after StableGuard is deployed, or set STABLE_GUARD_ADDRESS in .env now.
const TRUSTED_SENDER: string =
  process.env.STABLE_GUARD_ADDRESS ?? ethers.ZeroAddress;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("─".repeat(60));
  console.log("Deploying StableGuardReceiver to Sepolia");
  console.log("─".repeat(60));
  console.log("Deployer:      ", deployer.address);
  console.log("Balance:       ", ethers.formatEther(balance), "ETH");
  console.log("CCIP Router:   ", CCIP_ROUTER_SEPOLIA);
  console.log("Trusted sender:", TRUSTED_SENDER, TRUSTED_SENDER === ethers.ZeroAddress ? "(update via setTrustedSender after StableGuard deploys)" : "");
  console.log("─".repeat(60));

  const Receiver = await ethers.getContractFactory("StableGuardReceiver");
  const receiver = await Receiver.deploy(CCIP_ROUTER_SEPOLIA, TRUSTED_SENDER);

  console.log("Waiting for deployment...");
  await receiver.waitForDeployment();

  const address = await receiver.getAddress();
  console.log("");
  console.log("✓ StableGuardReceiver deployed:", address);
  console.log("  Etherscan:                   ", `https://sepolia.etherscan.io/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Add to .env:  CCIP_RECEIVER_ADDRESS=" + address);
  console.log("  2. Deploy StableGuard:  npm run deploy:sepolia");
  console.log("  3. Call setTrustedSender(<StableGuard address>) on this contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
