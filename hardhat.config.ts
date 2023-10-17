import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("hardhat-gas-reporter");

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.gnosis.gateway.fm",
      }
    }
  },
  solidity: "0.8.9",
  gasReporter: {
    enabled: true,
  }
};

export default config;
