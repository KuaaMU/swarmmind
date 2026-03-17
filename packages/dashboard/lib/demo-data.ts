import type {
  AgentStatus,
  Payment,
  Trade,
  TradingSignal,
  RiskAssessment,
  TradeStatus,
  ConsensusRound,
  LiquidityPoolDash,
} from "./types";

const DEMO_ADDRESSES = {
  "portfolio-manager": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
  "alpha-scout": "0x8Ba1f109551bD432803012645Ac136ddd64DBA72",
  "risk-oracle": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
  "trade-executor": "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
};

const TOKEN_PAIRS = ["OKB/USDC", "WETH/USDC", "USDT/USDC"];
const SERVICE_TYPES = ["SIGNAL_ANALYSIS", "RISK_ASSESSMENT", "TRADE_EXECUTION"];

let signalCounter = 0;
let paymentCounter = 0;
let tradeCounter = 0;

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createDemoAgents(): AgentStatus[] {
  return [
    {
      name: "Alpha Scout",
      role: "SCOUT",
      address: DEMO_ADDRESSES["alpha-scout"],
      isOnline: true,
      walletBalance: randomBetween(0.5, 2.0).toFixed(4),
      totalEarnings: randomBetween(0.01, 0.1).toFixed(4),
      totalSpending: "0.0000",
      lastActivity: Date.now() - Math.floor(randomBetween(1000, 30000)),
    },
    {
      name: "Risk Oracle",
      role: "ORACLE",
      address: DEMO_ADDRESSES["risk-oracle"],
      isOnline: true,
      walletBalance: randomBetween(0.5, 2.0).toFixed(4),
      totalEarnings: randomBetween(0.02, 0.15).toFixed(4),
      totalSpending: "0.0000",
      lastActivity: Date.now() - Math.floor(randomBetween(1000, 30000)),
    },
    {
      name: "Trade Executor",
      role: "EXECUTOR",
      address: DEMO_ADDRESSES["trade-executor"],
      isOnline: true,
      walletBalance: randomBetween(1.0, 5.0).toFixed(4),
      totalEarnings: "0.0000",
      totalSpending: randomBetween(0.01, 0.2).toFixed(4),
      lastActivity: Date.now() - Math.floor(randomBetween(1000, 30000)),
    },
    {
      name: "Portfolio Manager",
      role: "MANAGER",
      address: DEMO_ADDRESSES["portfolio-manager"],
      isOnline: true,
      walletBalance: randomBetween(2.0, 10.0).toFixed(4),
      totalEarnings: "0.0000",
      totalSpending: randomBetween(0.03, 0.3).toFixed(4),
      lastActivity: Date.now(),
    },
  ];
}

export function createDemoSignal(): TradingSignal {
  signalCounter += 1;
  return {
    id: `sig-demo-${signalCounter}`,
    tokenPair: randomChoice(TOKEN_PAIRS),
    confidence: parseFloat(randomBetween(0.4, 0.9).toFixed(2)),
    direction: randomChoice(["BUY", "SELL"] as const),
    timestamp: Date.now(),
  };
}

export function createDemoRiskAssessment(signalId: string): RiskAssessment {
  const riskScore = parseFloat(randomBetween(0.1, 0.8).toFixed(2));
  return {
    signalId,
    riskScore,
    recommendation: riskScore < 0.3 ? "APPROVE" : riskScore < 0.6 ? "REDUCE_SIZE" : "REJECT",
    maxPositionSize: randomBetween(0.1, 1.0).toFixed(4),
    timestamp: Date.now(),
  };
}

export function createDemoPayment(from: string, to: string, serviceType: string): Payment {
  paymentCounter += 1;
  const amounts: Record<string, number> = {
    SIGNAL_ANALYSIS: 0.001,
    RISK_ASSESSMENT: 0.002,
    TRADE_EXECUTION: 0.003,
  };
  return {
    id: `pay-demo-${paymentCounter}`,
    from,
    to,
    amount: (amounts[serviceType] || 0.001).toFixed(4),
    serviceType,
    txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    timestamp: Date.now(),
  };
}

export function createDemoTrade(signalId: string): Trade {
  tradeCounter += 1;
  const pair = randomChoice(TOKEN_PAIRS);
  const [tokenIn, tokenOut] = pair.split("/");
  return {
    id: `trade-demo-${tradeCounter}`,
    signalId,
    tokenIn,
    tokenOut,
    amountIn: randomBetween(0.01, 0.5).toFixed(4),
    amountOut: randomBetween(0.01, 0.5).toFixed(4),
    txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    status: "COMPLETED" as TradeStatus,
    timestamp: Date.now(),
  };
}

export function createInitialPayments(): Payment[] {
  const now = Date.now();
  return Array.from({ length: 8 }, (_, i) => ({
    id: `pay-init-${i}`,
    from: "portfolio-manager",
    to: randomChoice(["alpha-scout", "risk-oracle"]),
    amount: randomChoice(["0.0010", "0.0020"]),
    serviceType: randomChoice(SERVICE_TYPES),
    txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    timestamp: now - (8 - i) * 15000,
  }));
}

export function createInitialTrades(): Trade[] {
  const now = Date.now();
  return Array.from({ length: 5 }, (_, i) => {
    const pair = randomChoice(TOKEN_PAIRS);
    const [tokenIn, tokenOut] = pair.split("/");
    return {
      id: `trade-init-${i}`,
      signalId: `sig-init-${i}`,
      tokenIn,
      tokenOut,
      amountIn: randomBetween(0.01, 0.3).toFixed(4),
      amountOut: randomBetween(0.01, 0.3).toFixed(4),
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      status: randomChoice(["COMPLETED", "COMPLETED", "COMPLETED", "PENDING"] as TradeStatus[]),
      timestamp: now - (5 - i) * 25000,
    };
  });
}

// ─── Consensus / CRCN demo data ──────────────────────────────────────────────

const CONSENSUS_CLAIMS = [
  "APPROVE_TRADE:OKB/USDC:BUY",
  "REJECT_TRADE:WETH/USDC:SELL",
  "APPROVE_TRADE:WETH/USDC:BUY",
  "REDUCE_SIZE:OKB/USDC:BUY",
  "APPROVE_TRADE:USDT/USDC:BUY",
];

let roundCounter = 0;

function shortHash(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function createDemoConsensusRound(): ConsensusRound {
  roundCounter += 1;
  const totalProposals = randomBetween(3, 6) | 0;
  const supportCount = Math.ceil(totalProposals * randomBetween(0.5, 1.0));
  const weightedScore = parseFloat(randomBetween(0.6, 0.99).toFixed(4));
  return {
    roundId: `round-${roundCounter.toString().padStart(4, "0")}`,
    finalClaim: randomChoice(CONSENSUS_CLAIMS),
    weightedScore,
    supportCount,
    totalProposals,
    commitHash: `0x${shortHash()}`,
    challengeOpen: Math.random() < 0.15,
    timestamp: Date.now(),
  };
}

export function createInitialConsensusRounds(): ConsensusRound[] {
  const now = Date.now();
  return Array.from({ length: 6 }, (_, i) => {
    const totalProposals = (randomBetween(3, 6) | 0);
    const supportCount = Math.ceil(totalProposals * randomBetween(0.5, 1.0));
    return {
      roundId: `round-init-${i}`,
      finalClaim: randomChoice(CONSENSUS_CLAIMS),
      weightedScore: parseFloat(randomBetween(0.6, 0.99).toFixed(4)),
      supportCount,
      totalProposals,
      commitHash: `0x${shortHash()}`,
      challengeOpen: false,
      timestamp: now - (6 - i) * 30000,
    };
  });
}

// ─── Liquidity pool demo data ─────────────────────────────────────────────────

const POOL_PAIRS = [
  { pair: "OKB/USDC", base: 2_000_000 },
  { pair: "WETH/USDC", base: 8_000_000 },
  { pair: "USDT/USDC", base: 15_000_000 },
  { pair: "OKB/WETH", base: 500_000 },
  { pair: "WBTC/USDC", base: 5_000_000 },
] as const;

export function createInitialLiquidityPools(): LiquidityPoolDash[] {
  const now = Date.now();
  return POOL_PAIRS.map(({ pair, base }, i) => {
    const tvlUsd = base * randomBetween(0.8, 1.2);
    const volume24hUsd = tvlUsd * randomBetween(0.01, 0.12);
    const utilization = parseFloat(randomBetween(0.25, 0.75).toFixed(2));
    const apy = parseFloat(randomBetween(2, 35).toFixed(2));
    const priceImpactBps = Math.round((10_000 / (2 * tvlUsd)) * 10_000);
    const liquidityScore = Math.max(
      1,
      Math.min(
        10,
        Math.round(
          (Math.max(1, 10 - Math.floor(priceImpactBps / 100)) * 2 +
            (volume24hUsd / tvlUsd < 0.005 ? 3 : volume24hUsd / tvlUsd > 0.5 ? 4 : 8) +
            (utilization >= 0.3 && utilization <= 0.8 ? 8 : 4)) /
            4
        )
      )
    );
    const recommendation: LiquidityPoolDash["recommendation"] =
      tvlUsd < 100_000
        ? "AVOID"
        : priceImpactBps <= 10
        ? "DEEP"
        : priceImpactBps <= 50
        ? "ADEQUATE"
        : "SHALLOW";
    return {
      poolAddress: `0x${shortHash().slice(0, 40)}`,
      tokenPair: pair,
      tvlUsd,
      volume24hUsd,
      apy,
      utilization,
      liquidityScore,
      priceImpactBps,
      recommendation,
      timestamp: now - i * 5000,
    };
  });
}
