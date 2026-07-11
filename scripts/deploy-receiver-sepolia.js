const { ethers } = require("hardhat");

// ── Ethereum Sepolia constants ─────────────────────────────────────────────────
const CCIP_ROUTER        = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"; // Ethereum Sepolia CCIP Router
const TRUSTED_SENDER     = "0xdD1B9120C26490C02EE6Cd1D7FdE47f7031201c6"; // Arbitrum Sepolia StableGuard
const SOURCE_SELECTOR    = 3478487238524512106n;                          // Arbitrum Sepolia
const MOCK_VAULT         = "0x0B219D7045b879150b068EF86dDbDEAaBda6D1c4"; // Ethereum Sepolia MockVault

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);
  const network    = await ethers.provider.getNetwork();

  console.log("─".repeat(60));
  console.log("Deploying StableGuardReceiver to Ethereum Sepolia");
  console.log("─".repeat(60));
  console.log("Network:          ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer:         ", deployer.address);
  console.log("Balance:          ", ethers.formatEther(balance), "ETH");
  console.log("CCIP Router:      ", CCIP_ROUTER);
  console.log("Trusted sender:   ", TRUSTED_SENDER, "(Arbitrum Sepolia StableGuard)");
  console.log("Source selector:  ", SOURCE_SELECTOR.toString(), "(Arbitrum Sepolia)");
  console.log("Vault:            ", MOCK_VAULT, "(MockVault — will be set post-deploy)");
  console.log("─".repeat(60));

  // ── 1. Deploy ────────────────────────────────────────────────────────────────
  console.log("\n[1/3] Deploying StableGuardReceiver...");
  const Receiver = await ethers.getContractFactory("StableGuardReceiver");
  const receiver = await Receiver.deploy(CCIP_ROUTER, TRUSTED_SENDER, SOURCE_SELECTOR);
  await receiver.waitForDeployment();
  const address = await receiver.getAddress();
  console.log("      Deployed:", address);
  console.log("      Etherscan:", `https://sepolia.etherscan.io/address/${address}`);

  // ── 2. setVault ──────────────────────────────────────────────────────────────
  console.log("\n[2/3] Calling setVault()...");
  const tx = await receiver.setVault(MOCK_VAULT);
  await tx.wait();
  console.log("      ✓ vault set:", MOCK_VAULT);

  // ── 3. Verify ────────────────────────────────────────────────────────────────
  console.log("\n[3/3] Verifying...");
  const [onChainVault, onChainSender] = await Promise.all([
    receiver.vault(),
    receiver.trustedSender(),
  ]);
  const vaultOk  = onChainVault.toLowerCase()  === MOCK_VAULT.toLowerCase();
  const senderOk = onChainSender.toLowerCase() === TRUSTED_SENDER.toLowerCase();
  console.log(`      vault:         ${onChainVault}  ${vaultOk  ? "✓" : "✗"}`);
  console.log(`      trustedSender: ${onChainSender}  ${senderOk ? "✓" : "✗"}`);

  if (!vaultOk || !senderOk) throw new Error("Verification failed — check above");

  console.log("\n" + "─".repeat(60));
  console.log("✓ Receiver ready. Update README + wire-arbitrum-stableguard.js");
  console.log("  with the new receiver address:", address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
