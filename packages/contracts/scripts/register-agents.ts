import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const AGENT_REGISTRY_ADDRESS =
  process.env.AGENT_REGISTRY_ADDRESS || "0xf159428B2909159e2dd14aF0EFF37fe8fEb4C46f";

// AgentRole enum values matching Solidity
const ROLE = { SCOUT: 0, ORACLE: 1, EXECUTOR: 2, MANAGER: 3 } as const;

interface AgentConfig {
  readonly name: string;
  readonly role: number;
  readonly endpoint: string;
  readonly pricePerCall: bigint;
  readonly privateKeyEnv: string;
}

const AGENTS: readonly AgentConfig[] = [
  {
    name: "Alpha Scout",
    role: ROLE.SCOUT,
    endpoint: "http://localhost:3001",
    pricePerCall: 1000n, // 0.001 USDC (6 decimals)
    privateKeyEnv: "ALPHA_SCOUT_PRIVATE_KEY",
  },
  {
    name: "Risk Oracle",
    role: ROLE.ORACLE,
    endpoint: "http://localhost:3002",
    pricePerCall: 2000n, // 0.002 USDC
    privateKeyEnv: "RISK_ORACLE_PRIVATE_KEY",
  },
  {
    name: "Trade Executor",
    role: ROLE.EXECUTOR,
    endpoint: "http://localhost:3003",
    pricePerCall: 5000n, // 0.005 USDC
    privateKeyEnv: "TRADE_EXECUTOR_PRIVATE_KEY",
  },
  {
    name: "Portfolio Manager",
    role: ROLE.MANAGER,
    endpoint: "http://localhost:3000",
    pricePerCall: 0n,
    privateKeyEnv: "PORTFOLIO_MANAGER_PRIVATE_KEY",
  },
];

async function main() {
  console.log("=== SwarmMind Agent Registration ===\n");
  console.log("Registry:", AGENT_REGISTRY_ADDRESS);

  const registryAbi = [
    "function registerAgent(string name, uint8 role, string serviceEndpoint, uint256 pricePerCall) external",
    "function getAgent(address) view returns (tuple(address wallet, string name, uint8 role, string serviceEndpoint, uint256 pricePerCall, uint256 totalEarnings, uint256 totalSpending, bool isActive, uint256 registeredAt))",
    "function getAgentCount() view returns (uint256)",
    "event AgentRegistered(address indexed wallet, string name, uint8 role)",
  ];

  const txHashes: string[] = [];

  for (const agent of AGENTS) {
    const pk = process.env[agent.privateKeyEnv];
    if (!pk || pk.startsWith("0x_your")) {
      console.log(`  SKIP ${agent.name}: ${agent.privateKeyEnv} not configured`);
      continue;
    }

    const signer = new ethers.Wallet(pk, ethers.provider);
    const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, registryAbi, signer);
    const address = signer.address;
    console.log(`\n[${agent.name}] wallet: ${address}`);

    // Check if already registered
    try {
      const info = await registry.getAgent(address);
      if (info.isActive) {
        console.log(`  Already registered, skipping`);
        continue;
      }
    } catch {
      // Not registered yet - proceed
    }

    // Check balance
    const balance = await ethers.provider.getBalance(address);
    console.log(`  Balance: ${ethers.formatEther(balance)} OKB`);

    if (balance === 0n) {
      console.log(`  ERROR: No gas funds. Send OKB to ${address}`);
      continue;
    }

    try {
      console.log(`  Registering as ${agent.name} (role: ${agent.role})...`);
      const tx = await registry.registerAgent(
        agent.name,
        agent.role,
        agent.endpoint,
        agent.pricePerCall,
      );
      console.log(`  TX: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  Confirmed in block ${receipt?.blockNumber}, gas: ${receipt?.gasUsed}`);
      txHashes.push(tx.hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Agent already registered")) {
        console.log(`  Already registered (revert)`);
      } else {
        console.error(`  Registration failed: ${message}`);
      }
    }
  }

  // Summary
  const count = await new ethers.Contract(
    AGENT_REGISTRY_ADDRESS,
    ["function getAgentCount() view returns (uint256)"],
    ethers.provider,
  ).getAgentCount();

  console.log(`\n=== Registration Complete ===`);
  console.log(`Total agents on-chain: ${count}`);
  console.log(`TX hashes:`);
  for (const hash of txHashes) {
    console.log(`  https://www.oklink.com/xlayer-test/tx/${hash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
