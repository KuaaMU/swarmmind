import { describe, it, expect } from "vitest";
import type { ToolDefinition } from "@swarmmind/shared";
import {
  toAnthropicTools,
  fromAnthropicResponse,
  toAnthropicMessages,
  toOpenAITools,
  fromOpenAIResponse,
  toOpenAIMessages,
} from "@swarmmind/shared";
import type { Message } from "@swarmmind/shared";

const sampleTool: ToolDefinition = {
  name: "get_signals",
  description: "Fetch trading signals",
  input_schema: {
    type: "object",
    properties: { signal_type: { type: "string" } },
    required: [],
  },
};

// ─── Tool Definition Conversion ─────────────────────────────────────────────

describe("toAnthropicTools", () => {
  it("converts ToolDefinition to Anthropic format", () => {
    const result = toAnthropicTools([sampleTool]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "get_signals",
      description: "Fetch trading signals",
      input_schema: sampleTool.input_schema,
    });
  });

  it("handles empty array", () => {
    expect(toAnthropicTools([])).toEqual([]);
  });
});

describe("toOpenAITools", () => {
  it("converts ToolDefinition to OpenAI function format", () => {
    const result = toOpenAITools([sampleTool]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "function",
      function: {
        name: "get_signals",
        description: "Fetch trading signals",
        parameters: sampleTool.input_schema,
      },
    });
  });
});

// ─── Response Parsing ───────────────────────────────────────────────────────

describe("fromAnthropicResponse", () => {
  it("extracts text-only response", () => {
    const result = fromAnthropicResponse({
      content: [{ type: "text", text: "No trades needed." }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    expect(result.text).toBe("No trades needed.");
    expect(result.toolCalls).toEqual([]);
  });

  it("extracts tool_use blocks", () => {
    const result = fromAnthropicResponse({
      content: [
        { type: "text", text: "Let me check signals." },
        {
          type: "tool_use",
          id: "call_1",
          name: "get_signals",
          input: { signal_type: "ARBITRAGE" },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    expect(result.text).toBe("Let me check signals.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      id: "call_1",
      name: "get_signals",
      input: { signal_type: "ARBITRAGE" },
    });
  });

  it("handles multiple tool calls", () => {
    const result = fromAnthropicResponse({
      content: [
        { type: "tool_use", id: "c1", name: "get_signals", input: {} },
        { type: "tool_use", id: "c2", name: "get_portfolio_state", input: {} },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]!.name).toBe("get_signals");
    expect(result.toolCalls[1]!.name).toBe("get_portfolio_state");
  });
});

describe("fromOpenAIResponse", () => {
  it("extracts text-only response", () => {
    const result = fromOpenAIResponse({
      choices: [{ message: { content: "Done.", tool_calls: undefined } }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
      model: "gpt-4o-mini",
    });
    expect(result.text).toBe("Done.");
    expect(result.toolCalls).toEqual([]);
  });

  it("extracts function calls", () => {
    const result = fromOpenAIResponse({
      choices: [{
        message: {
          content: "Checking signals",
          tool_calls: [{
            id: "call_abc",
            type: "function",
            function: {
              name: "get_signals",
              arguments: '{"signal_type":"MOMENTUM"}',
            },
          }],
        },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      model: "gpt-4o-mini",
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      id: "call_abc",
      name: "get_signals",
      input: { signal_type: "MOMENTUM" },
    });
  });
});

// ─── Message Conversion ─────────────────────────────────────────────────────

describe("toAnthropicMessages", () => {
  it("converts user messages", () => {
    const msgs: Message[] = [{ role: "user", content: "Hello" }];
    const result = toAnthropicMessages(msgs);
    expect(result).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("converts assistant messages with tool calls", () => {
    const msgs: Message[] = [{
      role: "assistant",
      content: "I'll check.",
      toolCalls: [{ id: "c1", name: "get_signals", input: {} }],
    }];
    const result = toAnthropicMessages(msgs);
    expect(result).toHaveLength(1);
    const content = result[0]!.content as unknown[];
    expect(content).toHaveLength(2);
    expect((content[0] as { type: string }).type).toBe("text");
    expect((content[1] as { type: string }).type).toBe("tool_use");
  });

  it("converts tool_result messages", () => {
    const msgs: Message[] = [{
      role: "tool_result",
      toolCallId: "c1",
      content: '{"signals":[]}',
    }];
    const result = toAnthropicMessages(msgs);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("user");
    const content = result[0]!.content as unknown[];
    expect((content[0] as { type: string }).type).toBe("tool_result");
  });
});

describe("toOpenAIMessages", () => {
  it("converts user messages", () => {
    const msgs: Message[] = [{ role: "user", content: "Hello" }];
    expect(toOpenAIMessages(msgs)).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("converts tool_result to tool role", () => {
    const msgs: Message[] = [{
      role: "tool_result",
      toolCallId: "c1",
      content: "result",
    }];
    const result = toOpenAIMessages(msgs);
    expect(result[0]).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: "result",
    });
  });
});
