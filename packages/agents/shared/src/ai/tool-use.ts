/**
 * Tool-use types and format converters for multi-provider tool calling.
 *
 * Provides a unified interface that works with:
 * - Anthropic native tool_use API
 * - OpenAI-compatible function calling (OpenAI, DeepSeek, OpenRouter)
 */

// ─── Unified Types (provider-agnostic) ──────────────────────────────────────

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export interface ChatWithToolsResult {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
}

export type Message =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls?: readonly ToolCall[] }
  | { readonly role: "tool_result"; readonly toolCallId: string; readonly content: string };

// ─── Anthropic Format Converters ────────────────────────────────────────────

export interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
}

export interface AnthropicResponse {
  readonly content: readonly AnthropicContentBlock[];
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
  readonly stop_reason?: string;
}

export function toAnthropicTools(defs: readonly ToolDefinition[]): readonly AnthropicTool[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.input_schema,
  }));
}

export function fromAnthropicResponse(response: AnthropicResponse): ChatWithToolsResult {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "tool_use" && block.id && block.name) {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: (block.input as Record<string, unknown>) ?? {},
      });
    }
  }

  return { text: textParts.join("\n"), toolCalls };
}

export function toAnthropicMessages(
  msgs: readonly Message[],
): readonly Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const msg of msgs) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      const content: Record<string, unknown>[] = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
        }
      }
      result.push({ role: "assistant", content });
    } else if (msg.role === "tool_result") {
      result.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: msg.toolCallId, content: msg.content },
        ],
      });
    }
  }

  return result;
}

// ─── OpenAI-Compatible Format Converters ────────────────────────────────────

export interface OpenAITool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface OpenAIToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface OpenAIResponse {
  readonly choices: readonly [{
    readonly message: {
      readonly content: string | null;
      readonly tool_calls?: readonly OpenAIToolCall[];
    };
  }];
  readonly usage: { readonly prompt_tokens: number; readonly completion_tokens: number };
  readonly model: string;
}

export function toOpenAITools(defs: readonly ToolDefinition[]): readonly OpenAITool[] {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema,
    },
  }));
}

export function fromOpenAIResponse(response: OpenAIResponse): ChatWithToolsResult {
  const choice = response.choices[0];
  const text = choice?.message?.content ?? "";
  const toolCalls: ToolCall[] = [];

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      });
    }
  }

  return { text, toolCalls };
}

export function toOpenAIMessages(
  msgs: readonly Message[],
): readonly Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const msg of msgs) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      const entry: Record<string, unknown> = { role: "assistant", content: msg.content || null };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        entry.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }));
      }
      result.push(entry);
    } else if (msg.role === "tool_result") {
      result.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content,
      });
    }
  }

  return result;
}
