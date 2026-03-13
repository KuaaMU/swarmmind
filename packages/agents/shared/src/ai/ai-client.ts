/**
 * Unified AI client that supports multiple providers.
 * Agents can choose which provider/model to use via config or env.
 *
 * Supported providers:
 * - anthropic: Claude (Haiku, Sonnet, Opus)
 * - openai: GPT-4o, GPT-4o-mini, etc.
 * - deepseek: DeepSeek Chat/Reasoner
 * - openrouter: Access 100+ models via OpenRouter
 */

export type AIProvider = "anthropic" | "openai" | "deepseek" | "openrouter";

export interface AIResponse {
  readonly text: string;
  readonly provider: AIProvider;
  readonly model: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

export interface AIClientConfig {
  readonly provider: AIProvider;
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly baseUrl?: string;
}

// Default models per provider (fast + cheap for agent reasoning)
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  openrouter: "deepseek/deepseek-chat",
};

// Base URLs per provider
const BASE_URLS: Record<AIProvider, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  deepseek: "https://api.deepseek.com",
  openrouter: "https://openrouter.ai/api",
};

export class AIClient {
  private readonly provider: AIProvider;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(config: AIClientConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODELS[config.provider];
    this.maxTokens = config.maxTokens || 1024;
    this.baseUrl = config.baseUrl || BASE_URLS[config.provider];
  }

  async chat(systemPrompt: string, userMessage: string): Promise<AIResponse> {
    if (this.provider === "anthropic") {
      return this.callAnthropic(systemPrompt, userMessage);
    }
    // OpenAI, DeepSeek, OpenRouter all use OpenAI-compatible API
    return this.callOpenAICompatible(systemPrompt, userMessage);
  }

  async structuredChat<T>(systemPrompt: string, userMessage: string): Promise<T> {
    const jsonPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations, just the JSON object.`;
    const response = await this.chat(jsonPrompt, userMessage);

    const cleaned = response.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(cleaned) as T;
  }

  getProvider(): AIProvider { return this.provider; }
  getModel(): string { return this.model; }

  // --- Anthropic native API ---
  private async callAnthropic(systemPrompt: string, userMessage: string): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textBlock = data.content.find((b) => b.type === "text");
    return {
      text: textBlock?.text || "",
      provider: "anthropic",
      model: this.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }

  // --- OpenAI-compatible API (OpenAI, DeepSeek, OpenRouter) ---
  private async callOpenAICompatible(systemPrompt: string, userMessage: string): Promise<AIResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    };

    // OpenRouter requires extra headers
    if (this.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/swarmmind";
      headers["X-Title"] = "SwarmMind";
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${this.provider} API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      text: data.choices[0]?.message?.content || "",
      provider: this.provider,
      model: data.model || this.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

/**
 * Create an AIClient from environment variables.
 * Reads AI_PROVIDER to determine which provider to use.
 */
export function createAIClientFromEnv(): AIClient {
  const provider = (process.env.AI_PROVIDER || "anthropic") as AIProvider;

  const keyMap: Record<AIProvider, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };

  const apiKey = process.env[keyMap[provider]];
  if (!apiKey) {
    throw new Error(`Missing ${keyMap[provider]} for provider "${provider}"`);
  }

  const model = process.env.AI_MODEL || undefined;
  const baseUrl = process.env.AI_BASE_URL || undefined;

  return new AIClient({ provider, apiKey, model, baseUrl });
}
