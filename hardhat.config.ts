import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.ALCHEMY_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, "").replace(/^[^0-9a-fA-F]+/, "")}`]
        : [],
      chainId: 11155111,
    },
    arbitrumSepolia: {
      url: process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, "").replace(/^[^0-9a-fA-F]+/, "")}`]
        : [],
      chainId: 421614,
    },
    robinhoodChain: {
      url: process.env.ROBINHOOD_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [`0x${process.env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, "").replace(/^[^0-9a-fA-F]+/, "")}`]
        : [],
      chainId: 46630, // 0xb626 — confirmed via eth_chainId against https://rpc.testnet.chain.robinhood.com
    },
  },

  paths: {
    sources:   "./contracts",
    scripts:   "./scripts",
    artifacts: "./hardhat-artifacts",
    cache:     "./hardhat-cache",
  },
};

export default config;
