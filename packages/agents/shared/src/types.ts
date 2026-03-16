/**
 * Legacy type aliases – kept for backward compatibility.
 * New code should import from "./schemas" directly to get Zod-validated types.
 */

// ===== Agent Types =====

export type AgentRole = "SCOUT" | "ORACLE" | "EXECUTOR" | "MANAGER" | "RISK" | "LIQUIDITY";

export interface AgentInfo {
  readonly address: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly serviceEndpoint: string;
  readonly pricePerCall: number;
  readonly isActive: boolean;
}

// ===== Signal Types =====

export type SignalType = "ARBITRAGE" | "MOMENTUM" | "MEAN_REVERSION";

export interface TradingSignal {
  readonly id: string;
  readonly type: SignalType;
  readonly tokenPair: string;
  readonly direction: "BUY" | "SELL";
  readonly confidence: number;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly rationale: string;
  readonly timestamp: number;
  readonly source: string;
}

// ===== Risk Types =====

export type RiskRecommendation = "PROCEED" | "CAUTION" | "REJECT";

export interface RiskAssessment {
  readonly signalId: string;
  readonly riskScore: number;
  readonly maxDrawdown: number;
  readonly recommendation: RiskRecommendation;
  readonly rationale: string;
  readonly timestamp: number;
}

// ===== Trade Types =====

export type TradeStatus = "PENDING" | "APPROVED" | "EXECUTING" | "COMPLETED" | "FAILED";

export interface TradeExecution {
  readonly id: string;
  readonly signalId: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly amountIn: string;
  readonly amountOut: string;
  readonly txHash: string;
  readonly status: TradeStatus;
  readonly timestamp: number;
  readonly gasUsed?: string;
}

// ===== Payment Types =====

export interface PaymentRecord {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly serviceType: string;
  readonly txHash: string;
  readonly timestamp: number;
}

// ===== Portfolio Types =====

export interface PortfolioState {
  readonly totalValue: number;
  readonly positions: readonly Position[];
  readonly recentTrades: readonly TradeExecution[];
  readonly recentPayments: readonly PaymentRecord[];
  readonly agentStatuses: readonly AgentStatus[];
}

export interface Position {
  readonly token: string;
  readonly amount: string;
  readonly valueUsd: number;
  readonly entryPrice: number;
  readonly currentPrice: number;
  readonly pnl: number;
  readonly pnlPercent: number;
}

export interface AgentStatus {
  readonly name: string;
  readonly role: AgentRole;
  readonly address: string;
  readonly isOnline: boolean;
  readonly walletBalance: string;
  readonly totalEarnings: string;
  readonly totalSpending: string;
  readonly lastActivity: number;
}

// ===== WebSocket Message Types =====

export type WsMessageType =
  | "SIGNAL_DETECTED"
  | "RISK_ASSESSED"
  | "TRADE_EXECUTED"
  | "PAYMENT_MADE"
  | "AGENT_STATUS"
  | "PORTFOLIO_UPDATE";

export interface WsMessage {
  readonly type: WsMessageType;
  readonly data: unknown;
  readonly timestamp: number;
}

// ===== Strategy Types =====

export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

export interface UserStrategy {
  readonly riskTolerance: RiskTolerance;
  readonly maxPositionSize: number;
  readonly preferredTokens: readonly string[];
  readonly strategyType: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  readonly constraints: readonly string[];
}

// ===== API Response =====

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly timestamp: number;
}
