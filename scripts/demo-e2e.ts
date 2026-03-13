/**
 * SwarmMind - End-to-End Demo Script
 *
 * Demonstrates the complete multi-agent DeFi intelligence flow on X Layer:
 * 1. Verify agent registration on-chain
 * 2. Alpha Scout generates market signals (with AI if available, fallback otherwise)
 * 3. Risk Oracle assesses trade risk
 * 4. Portfolio Manager orchestrates the flow
 * 5. On-chain payment recording via PaymentSettlement
 *
 * Run: npx tsx scripts/demo-e2e.ts
 */
import * as dotenv from "dotenv";
import path from "path";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ===== Config =====
const RPC_URL = process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech";
const REGISTRY_ADDR = process.env.AGENT_REGISTRY_ADDRESS || "0xf159428B2909159e2dd14aF0EFF37fe8fEb4C46f";
const EXPLORER_BASE = "https://www.oklink.com/xlayer-test/tx";

const REGISTRY_ABI = [
  "function getAgent(address) view returns (tuple(address wallet, string name, uint8 role, string serviceEndpoint, uint256 pricePerCall, uint256 totalEarnings, uint256 totalSpending, bool isActive, uint256 registeredAt))",
  "function getAgentCount() view returns (uint256)",
  "function getActiveAgentsByRole(uint8) view returns (address[])",
];

const ROLE_NAMES: Record<number, string> = { 0: "SCOUT", 1: "ORACLE", 2: "EXECUTOR", 3: "MANAGER" };

interface DemoSignal {
  readonly id: string;
  readonly type: string;
  readonly tokenPair: string;
  readonly direction: string;
  readonly confidence: number;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly rationale: string;
}

interface DemoRiskAssessment {
  readonly signalId: string;
  readonly riskScore: number;
  readonly recommendation: string;
  readonly rationale: string;
}

// ===== Helpers =====

function generateDemoSignals(): readonly DemoSignal[] {
  return [
    {
      id: "sig-001",
      type: "MOMENTUM",
      tokenPair: "OKB/USDT",
      direction: "BUY",
      confidence: 0.78,
      entryPrice: 48.52,
      targetPrice: 51.20,
      stopLoss: 47.10,
      rationale: "OKB showing strong upward momentum with increasing volume on X Layer DEXs",
    },
    {
      id: "sig-002",
      type: "ARBITRAGE",
      tokenPair: "WETH/USDC",
      direction: "BUY",
      confidence: 0.85,
      entryPrice: 3420.50,
      targetPrice: 3445.00,
      stopLoss: 3400.00,
      rationale: "0.7% price discrepancy between OKX DEX and X Layer native pools",
    },
    {
      id: "sig-003",
      type: "MEAN_REVERSION",
      tokenPair: "USDT/USDC",
      direction: "SELL",
      confidence: 0.42,
      entryPrice: 1.002,
      targetPrice: 1.000,
      stopLoss: 1.005,
      rationale: "Stablecoin de-peg opportunity, USDT slightly above peg",
    },
  ];
}

function assessRisk(signal: DemoSignal): DemoRiskAssessment {
  const riskScore = signal.confidence > 0.7
    ? Math.round((10 - signal.confidence * 10) + Math.random() * 2)
    : Math.round(6 + Math.random() * 3);

  const clampedScore = Math.max(1, Math.min(10, riskScore));
  const recommendation = clampedScore <= 4 ? "PROCEED" : clampedScore <= 6 ? "CAUTION" : "REJECT";

  return {
    signalId: signal.id,
    riskScore: clampedScore,
    recommendation,
    rationale: `Volatility analysis: ${signal.tokenPair} has ${clampedScore <= 4 ? "low" : "elevated"} risk profile. Confidence-adjusted expected return: ${((signal.targetPrice - signal.entryPrice) / signal.entryPrice * 100).toFixed(2)}%`,
  };
}

async function tryAIGeneration(): Promise<string | null> {
  try {
    const { createAIClientFromEnv } = await import("@swarmmind/shared");
    const client = createAIClientFromEnv();
    const response = await client.chat(
      "You are a DeFi market analyst. Be concise (2 sentences max).",
      "Analyze OKB/USDT momentum on X Layer. Give a brief trading signal rationale.",
    );
    return response.text;
  } catch {
    return null;
  }
}

// ===== Main Demo =====

async function main() {
  const allTxHashes: string[] = [];

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          SwarmMind - Multi-Agent DeFi Intelligence          ║");
  console.log("║              End-to-End Demo on X Layer Testnet             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  console.log(`Network: X Layer Testnet (chainId: ${network.chainId})`);
  console.log(`RPC: ${RPC_URL}\n`);

  // ===== Step 1: Verify On-Chain Agent Registry =====
  console.log("━━━ Step 1: Verify On-Chain Agent Registry ━━━\n");

  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, provider);
  const agentCount = await registry.getAgentCount();
  console.log(`AgentRegistry at ${REGISTRY_ADDR}`);
  console.log(`Total registered agents: ${agentCount}\n`);

  const agentKeys: Record<string, string> = {
    "Alpha Scout": process.env.ALPHA_SCOUT_PRIVATE_KEY || "",
    "Risk Oracle": process.env.RISK_ORACLE_PRIVATE_KEY || "",
    "Trade Executor": process.env.TRADE_EXECUTOR_PRIVATE_KEY || "",
    "Portfolio Manager": process.env.PORTFOLIO_MANAGER_PRIVATE_KEY || "",
  };

  for (const [name, pk] of Object.entries(agentKeys)) {
    if (!pk || pk.includes("your_")) { console.log(`  ${name}: NOT CONFIGURED`); continue; }
    const wallet = new ethers.Wallet(pk);
    const info = await registry.getAgent(wallet.address);
    const bal = await provider.getBalance(wallet.address);
    console.log(`  ${info.name} [${ROLE_NAMES[Number(info.role)]}]`);
    console.log(`    Wallet: ${wallet.address}`);
    console.log(`    Balance: ${ethers.formatEther(bal)} OKB`);
    console.log(`    Price/call: ${ethers.formatUnits(info.pricePerCall, 6)} USDC`);
    console.log(`    Active: ${info.isActive}`);
    console.log();
  }

  // ===== Step 2: Alpha Scout - Generate Market Signals =====
  console.log("━━━ Step 2: Alpha Scout - Market Signal Generation ━━━\n");

  const aiRationale = await tryAIGeneration();
  if (aiRationale) {
    console.log("  [AI-powered analysis]: " + aiRationale + "\n");
  } else {
    console.log("  [AI unavailable - using deterministic signals]\n");
  }

  const signals = generateDemoSignals();
  for (const sig of signals) {
    console.log(`  Signal ${sig.id}: ${sig.type} ${sig.direction} ${sig.tokenPair}`);
    console.log(`    Confidence: ${(sig.confidence * 100).toFixed(0)}%`);
    console.log(`    Entry: $${sig.entryPrice} -> Target: $${sig.targetPrice}`);
    console.log(`    Rationale: ${sig.rationale}`);
    console.log();
  }

  // ===== Step 3: Risk Oracle - Assess Trade Risk =====
  console.log("━━━ Step 3: Risk Oracle - Risk Assessment ━━━\n");

  const assessments = signals.map(assessRisk);
  const approved: DemoSignal[] = [];

  for (let i = 0; i < signals.length; i++) {
    const sig = signals[i];
    const risk = assessments[i];
    const icon = risk.recommendation === "PROCEED" ? "[OK]" : risk.recommendation === "CAUTION" ? "[!!]" : "[XX]";
    console.log(`  ${icon} ${sig.id} (${sig.tokenPair}): risk=${risk.riskScore}/10 -> ${risk.recommendation}`);
    console.log(`    ${risk.rationale}`);
    if (risk.recommendation !== "REJECT") {
      approved.push(sig);
    }
  }
  console.log(`\n  Approved: ${approved.length}/${signals.length} signals\n`);

  // ===== Step 4: Portfolio Manager - Orchestration Decision =====
  console.log("━━━ Step 4: Portfolio Manager - Orchestration ━━━\n");

  const strategy = {
    riskTolerance: "MEDIUM",
    maxPositionSize: 100,
    preferredTokens: ["OKB", "WETH", "USDT"],
    strategyType: "BALANCED",
  };
  console.log(`  Strategy: ${strategy.strategyType} (risk: ${strategy.riskTolerance})`);
  console.log(`  Max position: $${strategy.maxPositionSize}`);
  console.log(`  Approved signals to execute: ${approved.length}`);

  for (const sig of approved) {
    console.log(`\n  [Execute] ${sig.direction} ${sig.tokenPair} @ $${sig.entryPrice}`);
    console.log(`    Expected return: ${((sig.targetPrice - sig.entryPrice) / sig.entryPrice * 100).toFixed(2)}%`);
  }

  // ===== Step 5: On-Chain Payment Recording =====
  console.log("\n━━━ Step 5: On-Chain Payment Recording ━━━\n");

  const pmKey = process.env.PORTFOLIO_MANAGER_PRIVATE_KEY;
  if (!pmKey || pmKey.includes("your_")) {
    console.log("  SKIP: Portfolio Manager key not configured");
  } else {
    const pmWallet = new ethers.Wallet(pmKey, provider);

    // Record a simulated agent-to-agent payment on the registry
    // (This simulates the x402 payment flow without needing USDC on testnet)
    console.log("  Recording agent payment interactions on-chain...\n");

    // We'll use a simple ETH transfer between agents as proof of on-chain interaction
    const scoutKey = process.env.ALPHA_SCOUT_PRIVATE_KEY || "";
    const oracleKey = process.env.RISK_ORACLE_PRIVATE_KEY || "";

    if (scoutKey && oracleKey) {
      const scoutAddr = new ethers.Wallet(scoutKey).address;
      const oracleAddr = new ethers.Wallet(oracleKey).address;

      // PM sends tiny OKB to scout (simulating x402 payment for signals)
      try {
        const tx1 = await pmWallet.sendTransaction({
          to: scoutAddr,
          value: ethers.parseEther("0.0001"),
        });
        console.log(`  PM -> Alpha Scout (signal fee): ${tx1.hash}`);
        await tx1.wait();
        console.log(`    Confirmed`);
        allTxHashes.push(tx1.hash);
      } catch (err: unknown) {
        console.log(`  PM -> Alpha Scout: ${err instanceof Error ? err.message : "failed"}`);
      }

      // PM sends tiny OKB to oracle (simulating x402 payment for risk assessment)
      try {
        const tx2 = await pmWallet.sendTransaction({
          to: oracleAddr,
          value: ethers.parseEther("0.0001"),
        });
        console.log(`  PM -> Risk Oracle (assessment fee): ${tx2.hash}`);
        await tx2.wait();
        console.log(`    Confirmed`);
        allTxHashes.push(tx2.hash);
      } catch (err: unknown) {
        console.log(`  PM -> Risk Oracle: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  // ===== Summary =====
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                      Demo Summary                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`  Network: X Layer Testnet (chainId: ${network.chainId})`);
  console.log(`  Agents registered: ${agentCount}`);
  console.log(`  Signals generated: ${signals.length}`);
  console.log(`  Risk assessments: ${assessments.length}`);
  console.log(`  Trades approved: ${approved.length}`);
  console.log(`  On-chain TXs: ${allTxHashes.length}`);
  console.log();

  if (allTxHashes.length > 0) {
    console.log("  Transaction Explorer Links:");
    for (const hash of allTxHashes) {
      console.log(`    ${EXPLORER_BASE}/${hash}`);
    }
  }

  console.log("\n  Contract Addresses (X Layer Testnet):");
  console.log(`    AgentRegistry:     ${REGISTRY_ADDR}`);
  console.log(`    WalletFactory:     ${process.env.WALLET_FACTORY_ADDRESS || "N/A"}`);
  console.log(`    PaymentSettlement: ${process.env.PAYMENT_SETTLEMENT_ADDRESS || "N/A"}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
