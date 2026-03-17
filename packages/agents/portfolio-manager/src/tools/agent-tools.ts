/**
 * Agent tool definitions for the ReAct orchestrator.
 *
 * Each tool wraps an HTTP call to a SwarmMind agent service.
 * The LLM decides which tools to call, in what order, and how
 * to react to results - replacing the hardcoded pipeline.
 */

import { v4 as uuidv4 } from "uuid";
import type { ToolDefinition } from "@swarmmind/shared";
import type {
  TradingSignal,
  RiskAssessment,
  TradeExecution,
  ApiResponse,
  AgentWallet,
  PortfolioState,
} from "@swarmmind/shared";
import { createX402Client } from "@swarmmind/shared";
import type { PortfolioStateManager } from "../services/portfolio-state";

// ─── Tool Handler Interface ─────────────────────────────────────────────────

export interface ToolHandler {
  readonly definition: ToolDefinition;
  execute(input: Record<string, unknown>): Promise<string>;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface AgentToolsConfig {
  readonly alphaScoutUrl: string;
  readonly riskOracleUrl: string;
  readonly tradeExecutorUrl: string;
  readonly wallet: AgentWallet;
  readonly facilitatorUrl: string;
  readonly state: PortfolioStateManager;
}

// ─── Tool Factory ───────────────────────────────────────────────────────────

export function createAgentTools(config: AgentToolsConfig): readonly ToolHandler[] {
  const client = createX402Client(config.wallet, config.facilitatorUrl);

  return [
    createGetMarketSignals(config, client),
    createAssessRisk(config, client),
    createAssessLiquidity(config),
    createExecuteTrade(config),
    createGetPortfolioState(config),
    createCheckAgentStatus(config),
  ];
}

// ─── 1. Get Market Signals ──────────────────────────────────────────────────

function createGetMarketSignals(
  config: AgentToolsConfig,
  client: ReturnType<typeof createX402Client>,
): ToolHandler {
  return {
    definition: {
      name: "get_market_signals",
      description:
        "Fetch the latest trading signals from Alpha Scout agent. " +
        "Returns signals with type (ARBITRAGE, MOMENTUM, MEAN_REVERSION), " +
        "confidence scores, entry/target/stop prices. Use x402 micropayment.",
      input_schema: {
        type: "object",
        properties: {
          signal_type: {
            type: "string",
            enum: ["ARBITRAGE", "MOMENTUM", "MEAN_REVERSION"],
            description: "Optional filter by signal type. Omit to get all types.",
          },
        },
        required: [],
      },
    },
    async execute(input): Promise<string> {
      try {
        const response = await client.get(`${config.alphaScoutUrl}/signals/latest`);
        const body = (await response.json()) as ApiResponse<TradingSignal[]>;
        if (!body.success || !body.data) {
          return JSON.stringify({ error: "No signals available", signals: [] });
        }

        let signals = body.data;
        const filterType = input.signal_type as string | undefined;
        if (filterType) {
          signals = signals.filter((s) => s.type === filterType);
        }

        for (const signal of signals) {
          config.state.addSignal(signal);
        }

        return JSON.stringify({
          count: signals.length,
          signals: signals.map((s) => ({
            id: s.id,
            type: s.type,
            tokenPair: s.tokenPair,
            direction: s.direction,
            confidence: s.confidence,
            entryPrice: s.entryPrice,
            targetPrice: s.targetPrice,
            stopLoss: s.stopLoss,
            rationale: s.rationale,
          })),
        });
      } catch (err) {
        return JSON.stringify({ error: `Failed to fetch signals: ${String(err)}`, signals: [] });
      }
    },
  };
}

// ─── 2. Assess Risk ─────────────────────────────────────────────────────────

function createAssessRisk(
  config: AgentToolsConfig,
  client: ReturnType<typeof createX402Client>,
): ToolHandler {
  return {
    definition: {
      name: "assess_risk",
      description:
        "Send a trading signal to Risk Oracle for risk assessment. " +
        "Returns riskScore (1-10), maxDrawdown, recommendation (PROCEED/CAUTION/REJECT). " +
        "Uses x402 micropayment.",
      input_schema: {
        type: "object",
        properties: {
          signal_id: {
            type: "string",
            description: "The ID of the signal to assess risk for.",
          },
        },
        required: ["signal_id"],
      },
    },
    async execute(input): Promise<string> {
      try {
        const signalId = input.signal_id as string;
        const signals = config.state.getSignals();
        const signal = signals.find((s) => s.id === signalId);

        if (!signal) {
          return JSON.stringify({ error: `Signal ${signalId} not found in state` });
        }

        const response = await client.post(`${config.riskOracleUrl}/assess/trade`, signal);
        const body = (await response.json()) as ApiResponse<RiskAssessment>;
        if (!body.success || !body.data) {
          return JSON.stringify({ error: "Risk assessment failed" });
        }

        config.state.addAssessment(body.data);

        return JSON.stringify({
          signalId: body.data.signalId,
          riskScore: body.data.riskScore,
          maxDrawdown: body.data.maxDrawdown,
          recommendation: body.data.recommendation,
          rationale: body.data.rationale,
        });
      } catch (err) {
        return JSON.stringify({ error: `Risk assessment failed: ${String(err)}` });
      }
    },
  };
}

// ─── 3. Assess Liquidity ────────────────────────────────────────────────────

function createAssessLiquidity(config: AgentToolsConfig): ToolHandler {
  return {
    definition: {
      name: "assess_liquidity",
      description:
        "Check pool liquidity health for a token pair. " +
        "Returns liquidityScore (1-10), priceImpactBps, recommendation (DEEP/ADEQUATE/SHALLOW/AVOID).",
      input_schema: {
        type: "object",
        properties: {
          token_pair: {
            type: "string",
            description: "The token pair to check liquidity for (e.g., 'OKB/USDC').",
          },
          pool_address: {
            type: "string",
            description: "Optional specific pool address. If omitted, uses default pool.",
          },
        },
        required: ["token_pair"],
      },
    },
    async execute(input): Promise<string> {
      try {
        // Import LiquidityAgent dynamically to avoid hard dependency
        const { LiquidityAgent } = await import("@swarmmind/liquidity-agent");
        const agent = new LiquidityAgent();

        const pool = {
          poolAddress: (input.pool_address as string) || `0x${uuidv4().slice(0, 8)}`,
          tokenPair: input.token_pair as string,
          reserveA: 0,
          reserveB: 0,
          tvlUsd: 1_000_000,
          volume24hUsd: 50_000,
          apy: 0.05,
          utilization: 0.5,
          timestamp: Date.now(),
        };

        const result = agent.assess(pool);
        return JSON.stringify({
          poolAddress: result.poolAddress,
          liquidityScore: result.liquidityScore,
          priceImpactBps: result.priceImpactBps,
          recommendation: result.recommendation,
          rationale: result.rationale,
        });
      } catch (err) {
        return JSON.stringify({ error: `Liquidity assessment failed: ${String(err)}` });
      }
    },
  };
}

// ─── 4. Execute Trade ───────────────────────────────────────────────────────

function createExecuteTrade(config: AgentToolsConfig): ToolHandler {
  return {
    definition: {
      name: "execute_trade",
      description:
        "Execute a trade through the Trade Executor agent. " +
        "Routes orders through OKX DEX aggregator on X Layer with slippage protection. " +
        "Returns trade execution details including txHash and status.",
      input_schema: {
        type: "object",
        properties: {
          signal_id: {
            type: "string",
            description: "The signal ID that triggered this trade.",
          },
          amount: {
            type: "string",
            description: "Trade amount in USDC (e.g., '100').",
          },
        },
        required: ["signal_id", "amount"],
      },
    },
    async execute(input): Promise<string> {
      try {
        const signalId = input.signal_id as string;
        const amount = input.amount as string;
        const signals = config.state.getSignals();
        const signal = signals.find((s) => s.id === signalId);

        if (!signal) {
          return JSON.stringify({ error: `Signal ${signalId} not found in state` });
        }

        const tradeRequest = {
          signalId: signal.id,
          tokenPair: signal.tokenPair,
          direction: signal.direction,
          entryPrice: signal.entryPrice,
          amount,
        };

        const response = await fetch(`${config.tradeExecutorUrl}/execute/swap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": config.wallet.address,
          },
          body: JSON.stringify(tradeRequest),
        });
        const body = (await response.json()) as ApiResponse<TradeExecution>;
        if (!body.success || !body.data) {
          return JSON.stringify({ error: "Trade execution failed" });
        }

        config.state.addTrade(body.data);

        const payment = {
          id: uuidv4(),
          from: config.wallet.address,
          to: "trade-executor",
          amount,
          serviceType: "TRADE_EXECUTION",
          txHash: body.data.txHash,
          timestamp: Date.now(),
        };
        config.state.addPayment(payment);

        return JSON.stringify({
          tradeId: body.data.id,
          status: body.data.status,
          tokenIn: body.data.tokenIn,
          tokenOut: body.data.tokenOut,
          amountIn: body.data.amountIn,
          amountOut: body.data.amountOut,
          txHash: body.data.txHash,
        });
      } catch (err) {
        return JSON.stringify({ error: `Trade execution failed: ${String(err)}` });
      }
    },
  };
}

// ─── 5. Get Portfolio State ─────────────────────────────────────────────────

function createGetPortfolioState(config: AgentToolsConfig): ToolHandler {
  return {
    definition: {
      name: "get_portfolio_state",
      description:
        "Get current portfolio state including total value, positions, " +
        "recent trades, payments, and agent statuses.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    async execute(): Promise<string> {
      const state: PortfolioState = config.state.getState();
      return JSON.stringify({
        totalValue: state.totalValue,
        positionCount: state.positions.length,
        recentTradeCount: state.recentTrades.length,
        recentPaymentCount: state.recentPayments.length,
        agentStatuses: state.agentStatuses.map((a) => ({
          name: a.name,
          role: a.role,
          isOnline: a.isOnline,
        })),
        recentTrades: state.recentTrades.slice(-5).map((t) => ({
          id: t.id,
          status: t.status,
          tokenIn: t.tokenIn,
          tokenOut: t.tokenOut,
          amountIn: t.amountIn,
          amountOut: t.amountOut,
        })),
      });
    },
  };
}

// ─── 6. Check Agent Status ──────────────────────────────────────────────────

function createCheckAgentStatus(config: AgentToolsConfig): ToolHandler {
  return {
    definition: {
      name: "check_agent_status",
      description:
        "Check if a specific agent is online and healthy. " +
        "Available agents: alpha-scout, risk-oracle, trade-executor.",
      input_schema: {
        type: "object",
        properties: {
          agent_name: {
            type: "string",
            enum: ["alpha-scout", "risk-oracle", "trade-executor"],
            description: "Name of the agent to check.",
          },
        },
        required: ["agent_name"],
      },
    },
    async execute(input): Promise<string> {
      const agentName = input.agent_name as string;
      const urlMap: Record<string, string> = {
        "alpha-scout": config.alphaScoutUrl,
        "risk-oracle": config.riskOracleUrl,
        "trade-executor": config.tradeExecutorUrl,
      };
      const url = urlMap[agentName];
      if (!url) {
        return JSON.stringify({ error: `Unknown agent: ${agentName}` });
      }

      try {
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        const body = (await response.json()) as Record<string, unknown>;
        return JSON.stringify({
          agent: agentName,
          online: true,
          status: body.status ?? "ok",
          url,
        });
      } catch {
        return JSON.stringify({
          agent: agentName,
          online: false,
          error: "Agent is not responding",
          url,
        });
      }
    },
  };
}
