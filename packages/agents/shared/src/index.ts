// Config
export { env } from "./config/env";
export { XLAYER_CONFIG, TOKEN_ADDRESSES, USDC_DECIMALS } from "./config/xlayer.config";
export type { ChainId } from "./config/xlayer.config";

// Wallet
export { AgentWallet } from "./wallet/agent-wallet";
export type { AgentWalletConfig } from "./wallet/agent-wallet";

// AI (multi-provider)
export { AIClient, createAIClientFromEnv } from "./ai/ai-client";
export type { AIProvider, AIResponse, AIClientConfig } from "./ai/ai-client";
// Legacy Claude client (backward compat)
export { ClaudeClient } from "./ai/claude-client";
export type { ClaudeResponse, ClaudeClientConfig } from "./ai/claude-client";
export { PROMPT_TEMPLATES } from "./ai/prompt-templates";

// Payments
export { x402PaymentMiddleware } from "./payments/x402-server";
export type { X402PricingConfig } from "./payments/x402-server";
export { x402Fetch, createX402Client } from "./payments/x402-client";
export type { X402PaymentConfig } from "./payments/x402-client";
export { DirectPayment } from "./payments/direct-payment";
export type { DirectPaymentConfig } from "./payments/direct-payment";

// OKX APIs
export { createOkxAuthHeaders } from "./okx/auth";
export type { OkxAuthConfig, OkxAuthHeaders } from "./okx/auth";
export { MarketApiClient } from "./okx/market-api";
export type { TokenPrice } from "./okx/market-api";
export { TradeApiClient } from "./okx/trade-api";
export type { SwapQuote, TradeApiConfig } from "./okx/trade-api";

// Types (legacy – backward compatible)
export type {
  AgentRole,
  AgentInfo,
  SignalType,
  TradingSignal,
  RiskRecommendation,
  RiskAssessment,
  TradeStatus,
  TradeExecution,
  PaymentRecord,
  PortfolioState,
  Position,
  AgentStatus,
  WsMessageType,
  WsMessage,
  UserStrategy,
  RiskTolerance,
  ApiResponse,
} from "./types";

// Schemas (Zod) + derived types — preferred for new code
export {
  AgentRoleSchema,
  AgentInfoSchema,
  SignalTypeSchema,
  TradingSignalSchema,
  RiskRecommendationSchema,
  RiskAssessmentSchema,
  LiquidityPoolSchema,
  LiquidityAssessmentSchema,
  AgentProposalSchema,
  ConsensusResultSchema,
  TradeStatusSchema,
  TradeExecutionSchema,
  PaymentRecordSchema,
  PositionSchema,
  AgentStatusSchema,
  PortfolioStateSchema,
  WsMessageTypeSchema,
  WsMessageSchema,
  RiskToleranceSchema,
  UserStrategySchema,
  ApiResponseSchema,
} from "./schemas";
export type {
  AgentProposal,
  ConsensusResult,
  LiquidityPool,
  LiquidityAssessment,
} from "./schemas";
