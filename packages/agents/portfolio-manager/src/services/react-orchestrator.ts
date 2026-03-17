/**
 * ReAct (Reasoning + Acting) Orchestrator.
 *
 * Replaces the hardcoded pipeline with an LLM-driven tool-use loop:
 *   1. Build context message with strategy + portfolio state
 *   2. LLM reasons and selects tools to call
 *   3. Execute tool calls, feed results back
 *   4. Repeat until LLM decides it's done (no more tool calls)
 *
 * The LLM dynamically decides which agents to call, in what order,
 * whether to proceed or abort, and how to react to unexpected results.
 */

import { EventEmitter } from "events";
import type {
  AIClient,
  ToolDefinition,
  Message,
  UserStrategy,
  WsMessageType,
} from "@swarmmind/shared";
import { PROMPT_TEMPLATES } from "@swarmmind/shared";
import type { ToolHandler } from "../tools/agent-tools";
import type { PortfolioStateManager } from "./portfolio-state";

const MAX_ITERATIONS = 10;
const LOOP_INTERVAL_MS = 30_000;

export interface ReasoningStep {
  readonly iteration: number;
  readonly text: string;
  readonly toolCalls: readonly {
    readonly name: string;
    readonly input: Record<string, unknown>;
    readonly result: string;
  }[];
  readonly timestamp: number;
}

export interface ReasoningTrace {
  readonly startedAt: number;
  readonly completedAt: number;
  readonly steps: readonly ReasoningStep[];
  readonly summary: string;
}

export class ReActOrchestrator extends EventEmitter {
  private readonly tools: Map<string, ToolHandler>;
  private readonly ai: AIClient;
  private readonly state: PortfolioStateManager;
  private strategy: UserStrategy | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private latestTrace: ReasoningTrace | null = null;

  constructor(
    ai: AIClient,
    toolHandlers: readonly ToolHandler[],
    state: PortfolioStateManager,
  ) {
    super();
    this.ai = ai;
    this.state = state;
    this.tools = new Map(toolHandlers.map((t) => [t.definition.name, t]));
  }

  setStrategy(strategy: UserStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): UserStrategy | null {
    return this.strategy;
  }

  isRunning(): boolean {
    return this.running;
  }

  getLatestTrace(): ReasoningTrace | null {
    return this.latestTrace;
  }

  start(strategy: UserStrategy): void {
    if (this.running) return;
    this.strategy = strategy;
    this.running = true;
    console.log("[ReAct] Starting orchestration loop");
    this.loopTimer = setInterval(() => {
      this.runOnce().catch((err) =>
        console.error("[ReAct] Loop error:", err),
      );
    }, LOOP_INTERVAL_MS);
    this.runOnce().catch((err) =>
      console.error("[ReAct] Initial run error:", err),
    );
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    console.log("[ReAct] Stopped");
  }

  async runOnce(): Promise<ReasoningTrace> {
    if (!this.strategy) {
      throw new Error("No strategy set");
    }

    const startedAt = Date.now();
    const steps: ReasoningStep[] = [];
    const messages: Message[] = [
      { role: "user", content: this.buildContextMessage() },
    ];
    const toolDefs = this.getToolDefinitions();

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.ai.chatWithTools(
        PROMPT_TEMPLATES.reactOrchestrator.system,
        messages,
        toolDefs,
      );

      const step: ReasoningStep = {
        iteration: i,
        text: response.text,
        toolCalls: [],
        timestamp: Date.now(),
      };

      if (response.toolCalls.length === 0) {
        // LLM decided it's done
        steps.push(step);
        this.broadcast("PORTFOLIO_UPDATE", this.state.getState());
        break;
      }

      // Add assistant message with tool calls to conversation
      messages.push({
        role: "assistant",
        content: response.text,
        toolCalls: response.toolCalls,
      });

      // Execute each tool call and collect results
      const toolCallResults: ReasoningStep["toolCalls"][number][] = [];
      for (const call of response.toolCalls) {
        this.broadcastToolCall(call.name, call.input);
        const result = await this.executeTool(call.name, call.input);
        messages.push({
          role: "tool_result",
          toolCallId: call.id,
          content: result,
        });
        toolCallResults.push({
          name: call.name,
          input: call.input,
          result,
        });
        this.broadcastToolResult(call.name, result);
      }

      steps.push({ ...step, toolCalls: toolCallResults });
    }

    const trace: ReasoningTrace = {
      startedAt,
      completedAt: Date.now(),
      steps,
      summary: steps[steps.length - 1]?.text ?? "",
    };

    this.latestTrace = trace;
    this.broadcast("PORTFOLIO_UPDATE", this.state.getState());
    this.emit("reasoning_complete", trace);

    return trace;
  }

  private buildContextMessage(): string {
    const strategyStr = this.strategy
      ? JSON.stringify(this.strategy)
      : "No strategy set";

    const portfolioState = this.state.getState();
    const portfolioSummary = JSON.stringify({
      totalValue: portfolioState.totalValue,
      positionCount: portfolioState.positions.length,
      recentTradeCount: portfolioState.recentTrades.length,
      agentCount: portfolioState.agentStatuses.length,
    });

    return PROMPT_TEMPLATES.reactOrchestrator.buildContext(
      strategyStr,
      portfolioSummary,
    );
  }

  private getToolDefinitions(): readonly ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const handler = this.tools.get(name);
    if (!handler) {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    try {
      return await handler.execute(input);
    } catch (err) {
      return JSON.stringify({ error: `Tool ${name} failed: ${String(err)}` });
    }
  }

  private broadcastToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): void {
    this.emit("ws", {
      type: "TOOL_CALL" as WsMessageType,
      data: { tool: toolName, input, phase: "request" },
      timestamp: Date.now(),
    });
  }

  private broadcastToolResult(toolName: string, result: string): void {
    this.emit("ws", {
      type: "TOOL_CALL" as WsMessageType,
      data: { tool: toolName, result, phase: "response" },
      timestamp: Date.now(),
    });

    // Also emit standard events for backward compat
    const eventMap: Record<string, WsMessageType> = {
      get_market_signals: "SIGNAL_DETECTED",
      assess_risk: "RISK_ASSESSED",
      execute_trade: "TRADE_EXECUTED",
      assess_liquidity: "LIQUIDITY_ASSESSED",
    };
    const mappedType = eventMap[toolName];
    if (mappedType) {
      try {
        this.broadcast(mappedType, JSON.parse(result));
      } catch {
        // result not valid JSON, skip
      }
    }
  }

  private broadcast(type: WsMessageType, data: unknown): void {
    this.emit("ws", { type, data, timestamp: Date.now() });
  }
}
