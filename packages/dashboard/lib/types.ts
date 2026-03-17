export interface AgentStatus {
  name: string;
  role: AgentRole;
  address: string;
  isOnline: boolean;
  walletBalance: string;
  totalEarnings: string;
  totalSpending: string;
  lastActivity: number;
}

export type AgentRole = "SCOUT" | "ORACLE" | "EXECUTOR" | "MANAGER";

export interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  serviceType: string;
  txHash: string;
  timestamp: number;
}

export interface Trade {
  id: string;
  signalId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  txHash: string;
  status: TradeStatus;
  timestamp: number;
}

export type TradeStatus = "COMPLETED" | "PENDING" | "EXECUTING" | "FAILED";

export interface PortfolioSummary {
  totalValue: number;
  pnl24h: number;
  activeAgents: number;
  totalPayments: number;
}

export interface TradingSignal {
  id: string;
  tokenPair: string;
  confidence: number;
  direction: "BUY" | "SELL";
  timestamp: number;
}

export interface RiskAssessment {
  signalId: string;
  riskScore: number;
  recommendation: "APPROVE" | "REJECT" | "REDUCE_SIZE";
  maxPositionSize: string;
  timestamp: number;
}

export interface PortfolioData {
  summary: PortfolioSummary;
  agents: AgentStatus[];
  payments: Payment[];
  trades: Trade[];
  signals: TradingSignal[];
  isDemo: boolean;
}

export const AGENT_COLORS: Record<AgentRole, string> = {
  SCOUT: "#3b82f6",
  ORACLE: "#eab308",
  EXECUTOR: "#22c55e",
  MANAGER: "#a855f7",
};

export const AGENT_IDS: Record<string, AgentRole> = {
  "portfolio-manager": "MANAGER",
  "alpha-scout": "SCOUT",
  "risk-oracle": "ORACLE",
  "trade-executor": "EXECUTOR",
};

export const AGENT_LABELS: Record<string, string> = {
  "portfolio-manager": "PM",
  "alpha-scout": "Scout",
  "risk-oracle": "Oracle",
  "trade-executor": "Exec",
};

// ===== ReAct Reasoning types =====

export interface ReasoningToolCall {
  name: string;
  input: Record<string, unknown>;
  result: string;
}

export interface ReasoningStep {
  iteration: number;
  text: string;
  toolCalls: ReasoningToolCall[];
  timestamp: number;
}

export interface ReasoningTrace {
  startedAt: number;
  completedAt: number;
  steps: ReasoningStep[];
  summary: string;
}

// ===== Consensus / CRCN types =====

export interface ConsensusRound {
  roundId: string;
  finalClaim: string;
  weightedScore: number;
  supportCount: number;
  totalProposals: number;
  commitHash: string;
  challengeOpen: boolean;
  timestamp: number;
}

export interface LiquidityPoolDash {
  poolAddress: string;
  tokenPair: string;
  tvlUsd: number;
  volume24hUsd: number;
  apy: number;
  utilization: number;
  liquidityScore: number;
  priceImpactBps: number;
  recommendation: "DEEP" | "ADEQUATE" | "SHALLOW" | "AVOID";
  timestamp: number;
}
