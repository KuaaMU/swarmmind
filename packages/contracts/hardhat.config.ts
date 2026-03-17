import { HardhatUserConfig, subtask } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

// ─── Offline compiler shim ────────────────────────────────────────────────────
// When binaries.soliditylang.org is unreachable (CI sandbox), fall back to the
// solcjs bundled inside the npm `solc` package that was installed as a devDep.
subtask("compile:solidity:solc:get-build")
  .setAction(async () => {
    const solcJsPath = require.resolve("solc/soljson.js");
    return {
      version: "0.8.26",
      longVersion: "0.8.26+commit.8a97fa7a.Emscripten.clang",
      compilerPath: solcJsPath,
      isSolcJs: true,
      isNative: false,
    };
  });

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech",
      chainId: 1952,
      accounts: [DEPLOYER_KEY],
    },
    xlayer: {
      url: process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [DEPLOYER_KEY],
    },
  },
};

export default config;
