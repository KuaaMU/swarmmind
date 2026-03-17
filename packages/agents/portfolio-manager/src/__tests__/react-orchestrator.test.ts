import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReActOrchestrator } from "../services/react-orchestrator";
import type { ToolHandler } from "../tools/agent-tools";
import { PortfolioStateManager } from "../services/portfolio-state";
import type { AIClient, ChatWithToolsResult, ToolDefinition, Message } from "@swarmmind/shared";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockAI(responses: ChatWithToolsResult[]): AIClient {
  let callIndex = 0;
  return {
    getProvider: () => "anthropic",
    getModel: () => "mock-model",
    chatWithTools: vi.fn(async (
      _system: string,
      _messages: readonly Message[],
      _tools: readonly ToolDefinition[],
    ): Promise<ChatWithToolsResult> => {
      const response = responses[callIndex] ?? { text: "Done.", toolCalls: [] };
      callIndex++;
      return response;
    }),
    chat: vi.fn(),
    structuredChat: vi.fn(),
  } as unknown as AIClient;
}

function createMockTool(name: string, result: string): ToolHandler {
  return {
    definition: {
      name,
      description: `Mock ${name}`,
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: vi.fn(async () => result),
  };
}

function createTestState(): PortfolioStateManager {
  // Use a temporary state that doesn't persist to disk
  const state = new PortfolioStateManager();
  return state;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ReActOrchestrator", () => {
  const defaultStrategy = {
    riskTolerance: "MEDIUM" as const,
    maxPositionSize: 100,
    preferredTokens: ["OKB", "USDC"],
    strategyType: "BALANCED" as const,
    constraints: [],
  };

  describe("runOnce - LLM decides to stop immediately", () => {
    it("completes with no tool calls when LLM returns text only", async () => {
      const ai = createMockAI([
        { text: "Market conditions are unfavorable. No trades needed.", toolCalls: [] },
      ]);
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [], state);
      orchestrator.setStrategy(defaultStrategy);

      const trace = await orchestrator.runOnce();

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0]!.text).toContain("unfavorable");
      expect(trace.steps[0]!.toolCalls).toEqual([]);
      expect(trace.summary).toContain("unfavorable");
      expect(ai.chatWithTools).toHaveBeenCalledTimes(1);
    });
  });

  describe("runOnce - LLM calls one tool then stops", () => {
    it("executes tool and feeds result back", async () => {
      const signalResult = JSON.stringify({ count: 2, signals: [{ id: "s1" }, { id: "s2" }] });
      const ai = createMockAI([
        {
          text: "Let me check market signals.",
          toolCalls: [{ id: "call_1", name: "get_market_signals", input: {} }],
        },
        {
          text: "Found 2 signals but conditions not favorable. Ending cycle.",
          toolCalls: [],
        },
      ]);
      const signalTool = createMockTool("get_market_signals", signalResult);
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [signalTool], state);
      orchestrator.setStrategy(defaultStrategy);

      const trace = await orchestrator.runOnce();

      expect(trace.steps).toHaveLength(2);
      expect(trace.steps[0]!.toolCalls).toHaveLength(1);
      expect(trace.steps[0]!.toolCalls[0]!.name).toBe("get_market_signals");
      expect(trace.steps[0]!.toolCalls[0]!.result).toBe(signalResult);
      expect(signalTool.execute).toHaveBeenCalledTimes(1);
      expect(ai.chatWithTools).toHaveBeenCalledTimes(2);
    });
  });

  describe("runOnce - multi-step tool-use chain", () => {
    it("calls signals → risk → executes trade across 3 iterations", async () => {
      const ai = createMockAI([
        {
          text: "Scanning market...",
          toolCalls: [{ id: "c1", name: "get_market_signals", input: {} }],
        },
        {
          text: "Found signal s1. Assessing risk...",
          toolCalls: [{ id: "c2", name: "assess_risk", input: { signal_id: "s1" } }],
        },
        {
          text: "Risk acceptable. Executing trade.",
          toolCalls: [{ id: "c3", name: "execute_trade", input: { signal_id: "s1", amount: "50" } }],
        },
        {
          text: "Trade executed successfully. Cycle complete.",
          toolCalls: [],
        },
      ]);

      const tools = [
        createMockTool("get_market_signals", '{"count":1,"signals":[{"id":"s1"}]}'),
        createMockTool("assess_risk", '{"riskScore":3,"recommendation":"PROCEED"}'),
        createMockTool("execute_trade", '{"tradeId":"t1","status":"COMPLETED"}'),
      ];

      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, tools, state);
      orchestrator.setStrategy(defaultStrategy);

      const trace = await orchestrator.runOnce();

      expect(trace.steps).toHaveLength(4);
      expect(trace.steps[0]!.toolCalls[0]!.name).toBe("get_market_signals");
      expect(trace.steps[1]!.toolCalls[0]!.name).toBe("assess_risk");
      expect(trace.steps[2]!.toolCalls[0]!.name).toBe("execute_trade");
      expect(trace.steps[3]!.toolCalls).toEqual([]);
      expect(ai.chatWithTools).toHaveBeenCalledTimes(4);
    });
  });

  describe("runOnce - safety limit", () => {
    it("stops after MAX_ITERATIONS even if LLM keeps calling tools", async () => {
      const infiniteToolCalls: ChatWithToolsResult[] = Array.from({ length: 15 }, (_, i) => ({
        text: `Iteration ${i}`,
        toolCalls: [{ id: `c${i}`, name: "get_portfolio_state", input: {} }],
      }));

      const ai = createMockAI(infiniteToolCalls);
      const tool = createMockTool("get_portfolio_state", '{"totalValue":0}');
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [tool], state);
      orchestrator.setStrategy(defaultStrategy);

      const trace = await orchestrator.runOnce();

      // MAX_ITERATIONS = 10, so should stop at 10 steps
      expect(trace.steps.length).toBeLessThanOrEqual(10);
      expect(ai.chatWithTools).toHaveBeenCalledTimes(10);
    });
  });

  describe("runOnce - unknown tool gracefully fails", () => {
    it("returns error JSON for unknown tool", async () => {
      const ai = createMockAI([
        {
          text: "Calling unknown tool",
          toolCalls: [{ id: "c1", name: "nonexistent_tool", input: {} }],
        },
        { text: "Tool failed. Ending.", toolCalls: [] },
      ]);

      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [], state);
      orchestrator.setStrategy(defaultStrategy);

      const trace = await orchestrator.runOnce();

      expect(trace.steps[0]!.toolCalls[0]!.result).toContain("Unknown tool");
    });
  });

  describe("error handling", () => {
    it("throws when no strategy is set", async () => {
      const ai = createMockAI([]);
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [], state);

      await expect(orchestrator.runOnce()).rejects.toThrow("No strategy set");
    });
  });

  describe("WebSocket events", () => {
    it("emits TOOL_CALL events for each tool invocation", async () => {
      const ai = createMockAI([
        {
          text: "Checking...",
          toolCalls: [{ id: "c1", name: "get_market_signals", input: {} }],
        },
        { text: "Done.", toolCalls: [] },
      ]);
      const tool = createMockTool("get_market_signals", '{"count":0,"signals":[]}');
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [tool], state);
      orchestrator.setStrategy(defaultStrategy);

      const wsEvents: unknown[] = [];
      orchestrator.on("ws", (msg) => wsEvents.push(msg));

      await orchestrator.runOnce();

      const toolCallEvents = wsEvents.filter(
        (e) => (e as { type: string }).type === "TOOL_CALL",
      );
      // request + response = 2 events per tool call
      expect(toolCallEvents).toHaveLength(2);
    });
  });

  describe("getLatestTrace", () => {
    it("stores the latest trace after runOnce", async () => {
      const ai = createMockAI([{ text: "Done.", toolCalls: [] }]);
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [], state);
      orchestrator.setStrategy(defaultStrategy);

      expect(orchestrator.getLatestTrace()).toBeNull();
      await orchestrator.runOnce();
      expect(orchestrator.getLatestTrace()).not.toBeNull();
      expect(orchestrator.getLatestTrace()!.summary).toBe("Done.");
    });
  });

  describe("start/stop lifecycle", () => {
    it("tracks running state", () => {
      const ai = createMockAI([{ text: "Done.", toolCalls: [] }]);
      const state = createTestState();
      const orchestrator = new ReActOrchestrator(ai, [], state);

      expect(orchestrator.isRunning()).toBe(false);
      orchestrator.start(defaultStrategy);
      expect(orchestrator.isRunning()).toBe(true);
      orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);
    });
  });
});
