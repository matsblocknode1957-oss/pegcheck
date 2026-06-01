import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    sepolia: {
      url: process.env.ALCHEMY_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
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
