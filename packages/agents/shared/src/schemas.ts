/**
 * SwarmMind v1 – Shared Protocol Schemas (Zod)
 *
 * Every core data structure is validated at runtime via these schemas.
 * The TypeScript types in types.ts are now derived from these schemas so
 * there is a single source of truth.
 */

import { z } from "zod";

// ===== Agent =====

export const AgentRoleSchema = z.enum(["SCOUT", "ORACLE", "EXECUTOR", "MANAGER", "RISK", "LIQUIDITY"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentInfoSchema = z.object({
  address: z.string().min(1),
  name: z.string().min(1),
  role: AgentRoleSchema,
  serviceEndpoint: z.string().url(),
  pricePerCall: z.number().nonnegative(),
  isActive: z.boolean(),
});
export type AgentInfo = z.infer<typeof AgentInfoSchema>;

// ===== Trading Signal =====

export const SignalTypeSchema = z.enum(["ARBITRAGE", "MOMENTUM", "MEAN_REVERSION"]);
export type SignalType = z.infer<typeof SignalTypeSchema>;

export const TradingSignalSchema = z.object({
  id: z.string().min(1),
  type: SignalTypeSchema,
  tokenPair: z.string().min(1),
  direction: z.enum(["BUY", "SELL"]),
  /** 0–1 confidence fraction */
  confidence: z.number().min(0).max(1),
  entryPrice: z.number().positive(),
  targetPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  rationale: z.string(),
  timestamp: z.number().int().positive(),
  source: z.string().min(1),
});
export type TradingSignal = z.infer<typeof TradingSignalSchema>;

// ===== Risk Assessment =====

export const RiskRecommendationSchema = z.enum(["PROCEED", "CAUTION", "REJECT"]);
export type RiskRecommendation = z.infer<typeof RiskRecommendationSchema>;

export const RiskAssessmentSchema = z.object({
  signalId: z.string().min(1),
  /** 1–10 risk score */
  riskScore: z.number().int().min(1).max(10),
  maxDrawdown: z.number().nonnegative(),
  recommendation: RiskRecommendationSchema,
  rationale: z.string(),
  timestamp: z.number().int().positive(),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// ===== Liquidity =====

export const LiquidityPoolSchema = z.object({
  poolAddress: z.string().min(1),
  tokenPair: z.string().min(1),
  reserveA: z.number().nonnegative(),
  reserveB: z.number().nonnegative(),
  /** Total value locked in USD */
  tvlUsd: z.number().nonnegative(),
  /** 24-hour volume in USD */
  volume24hUsd: z.number().nonnegative(),
  /** Annual percentage yield */
  apy: z.number().nonnegative(),
  /** Utilization ratio 0–1 */
  utilization: z.number().min(0).max(1),
  timestamp: z.number().int().positive(),
});
export type LiquidityPool = z.infer<typeof LiquidityPoolSchema>;

export const LiquidityAssessmentSchema = z.object({
  poolAddress: z.string().min(1),
  /** 1–10 score: 10 = excellent liquidity */
  liquidityScore: z.number().int().min(1).max(10),
  /** Estimated price impact for a $10k trade */
  priceImpactBps: z.number().nonnegative(),
  recommendation: z.enum(["DEEP", "ADEQUATE", "SHALLOW", "AVOID"]),
  rationale: z.string(),
  timestamp: z.number().int().positive(),
});
export type LiquidityAssessment = z.infer<typeof LiquidityAssessmentSchema>;

// ===== Consensus =====

export const AgentProposalSchema = z.object({
  agentId: z.string().min(1),
  agentRole: AgentRoleSchema,
  /** The claim/conclusion being proposed */
  claim: z.string().min(1),
  /** Optional structured payload for typed use-cases */
  payload: z.unknown().optional(),
  /** Confidence of this claim, 0–1 */
  confidence: z.number().min(0).max(1),
  /** Evidence pointers (tx hashes, block numbers, API refs) */
  evidencePointers: z.array(z.string()),
  /** SHA-256 hash of the full reasoning trace (stored off-chain) */
  traceHash: z.string().optional(),
  timestamp: z.number().int().positive(),
});
export type AgentProposal = z.infer<typeof AgentProposalSchema>;

export const ConsensusResultSchema = z.object({
  roundId: z.string().min(1),
  /** The claim that reached consensus */
  finalClaim: z.string(),
  /** Weighted score that produced this result, 0–1 */
  weightedScore: z.number().min(0).max(1),
  /** Number of proposals that supported the final claim */
  supportCount: z.number().int().nonnegative(),
  /** Total proposals submitted */
  totalProposals: z.number().int().positive(),
  /** Per-proposal contribution scores */
  contributions: z.array(
    z.object({
      agentId: z.string(),
      rawConfidence: z.number(),
      weight: z.number(),
      penalizedWeight: z.number(),
      included: z.boolean(),
    }),
  ),
  /** Whether a challenge window is still open */
  challengeOpen: z.boolean(),
  /** Block timestamp when challenge window closes (0 = no challenge) */
  challengeExpiresAt: z.number().int().nonnegative(),
  /** Merkle root (SHA-256) computed over all evidence pointer hashes from winning proposals */
  evidenceRoot: z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char hex SHA-256").optional(),
  /** keccak256 of (finalClaim + weightedScore + roundId) for on-chain commit */
  commitHash: z.string().optional(),
  timestamp: z.number().int().positive(),
});
export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;

// ===== Trade Execution =====

export const TradeStatusSchema = z.enum(["PENDING", "APPROVED", "EXECUTING", "COMPLETED", "FAILED"]);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

export const TradeExecutionSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.string().min(1),
  amountOut: z.string().min(1),
  txHash: z.string(),
  status: TradeStatusSchema,
  timestamp: z.number().int().positive(),
  gasUsed: z.string().optional(),
});
export type TradeExecution = z.infer<typeof TradeExecutionSchema>;

// ===== Payment =====

export const PaymentRecordSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
  serviceType: z.string().min(1),
  txHash: z.string(),
  timestamp: z.number().int().positive(),
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

// ===== Portfolio =====

export const PositionSchema = z.object({
  token: z.string().min(1),
  amount: z.string().min(1),
  valueUsd: z.number().nonnegative(),
  entryPrice: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  pnl: z.number(),
  pnlPercent: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const AgentStatusSchema = z.object({
  name: z.string().min(1),
  role: AgentRoleSchema,
  address: z.string().min(1),
  isOnline: z.boolean(),
  walletBalance: z.string(),
  totalEarnings: z.string(),
  totalSpending: z.string(),
  lastActivity: z.number().int().nonnegative(),
});
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const PortfolioStateSchema = z.object({
  totalValue: z.number().nonnegative(),
  positions: z.array(PositionSchema),
  recentTrades: z.array(TradeExecutionSchema),
  recentPayments: z.array(PaymentRecordSchema),
  agentStatuses: z.array(AgentStatusSchema),
});
export type PortfolioState = z.infer<typeof PortfolioStateSchema>;

// ===== WebSocket =====

export const WsMessageTypeSchema = z.enum([
  "SIGNAL_DETECTED",
  "RISK_ASSESSED",
  "TRADE_EXECUTED",
  "PAYMENT_MADE",
  "AGENT_STATUS",
  "PORTFOLIO_UPDATE",
  "CONSENSUS_REACHED",
  "LIQUIDITY_ASSESSED",
]);
export type WsMessageType = z.infer<typeof WsMessageTypeSchema>;

export const WsMessageSchema = z.object({
  type: WsMessageTypeSchema,
  data: z.unknown(),
  timestamp: z.number().int().positive(),
});
export type WsMessage = z.infer<typeof WsMessageSchema>;

// ===== Strategy =====

export const RiskToleranceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export const UserStrategySchema = z.object({
  riskTolerance: RiskToleranceSchema,
  maxPositionSize: z.number().positive(),
  preferredTokens: z.array(z.string()),
  strategyType: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]),
  constraints: z.array(z.string()),
});
export type UserStrategy = z.infer<typeof UserStrategySchema>;

// ===== API Response =====

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    timestamp: z.number().int().positive(),
  });
