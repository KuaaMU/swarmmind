import type {
  AgentStatus,
  Payment,
  Trade,
  TradingSignal,
  RiskAssessment,
  TradeStatus,
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
