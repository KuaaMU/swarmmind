import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeResponse {
  readonly text: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

export interface ClaudeClientConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

export class ClaudeClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ClaudeClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || "claude-haiku-4-5-20251001";
    this.maxTokens = config.maxTokens || 1024;
  }

  async chat(
    systemPrompt: string,
    userMessage: string
  ): Promise<ClaudeResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      text: textBlock ? textBlock.text : "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async structuredChat<T>(
    systemPrompt: string,
    userMessage: string
  ): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations, just the JSON object.`;
    const response = await this.chat(jsonSystemPrompt, userMessage);

    const cleaned = response.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(cleaned) as T;
  }
}
