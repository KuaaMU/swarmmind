import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIClient, createAIClientFromEnv } from "../ai/ai-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe("AIClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("uses default model when none provided", () => {
      const client = new AIClient({ provider: "anthropic", apiKey: "test-key" });
      expect(client.getProvider()).toBe("anthropic");
      expect(client.getModel()).toBe("claude-haiku-4-5-20251001");
    });

    it("uses custom model when provided", () => {
      const client = new AIClient({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-4o",
      });
      expect(client.getModel()).toBe("gpt-4o");
    });

    it("uses custom baseUrl when provided", () => {
      const client = new AIClient({
        provider: "openai",
        apiKey: "test-key",
        baseUrl: "https://my-relay.com",
      });
      expect(client.getProvider()).toBe("openai");
    });
  });

  describe("chat - anthropic", () => {
    it("calls Anthropic API with correct headers and body", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          content: [{ type: "text", text: "Hello from Claude" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );

      const client = new AIClient({ provider: "anthropic", apiKey: "sk-ant-test" });
      const result = await client.chat("You are helpful", "Hi");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(opts.method).toBe("POST");
      expect(opts.headers["x-api-key"]).toBe("sk-ant-test");
      expect(opts.headers["anthropic-version"]).toBe("2023-06-01");

      const body = JSON.parse(opts.body);
      expect(body.system).toBe("You are helpful");
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);

      expect(result.text).toBe("Hello from Claude");
      expect(result.provider).toBe("anthropic");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "Invalid key" }, 401),
      );

      const client = new AIClient({ provider: "anthropic", apiKey: "bad-key" });
      await expect(client.chat("sys", "hi")).rejects.toThrow("Anthropic API error 401");
    });

    it("uses custom baseUrl for relay provider", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          content: [{ type: "text", text: "Relayed" }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );

      const client = new AIClient({
        provider: "anthropic",
        apiKey: "relay-key",
        baseUrl: "https://relay.example.com",
      });
      await client.chat("sys", "hi");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://relay.example.com/v1/messages");
    });
  });

  describe("chat - openai compatible", () => {
    it("calls OpenAI-compatible API for openai provider", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "Hello from GPT" } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 },
          model: "gpt-4o-mini",
        }),
      );

      const client = new AIClient({ provider: "openai", apiKey: "sk-test" });
      const result = await client.chat("System prompt", "User msg");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(opts.headers["Authorization"]).toBe("Bearer sk-test");

      const body = JSON.parse(opts.body);
      expect(body.messages).toEqual([
        { role: "system", content: "System prompt" },
        { role: "user", content: "User msg" },
      ]);

      expect(result.text).toBe("Hello from GPT");
      expect(result.provider).toBe("openai");
      expect(result.usage.inputTokens).toBe(8);
    });

    it("calls deepseek endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "DeepSeek reply" } }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
          model: "deepseek-chat",
        }),
      );

      const client = new AIClient({ provider: "deepseek", apiKey: "ds-key" });
      const result = await client.chat("sys", "hi");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
      expect(result.text).toBe("DeepSeek reply");
    });

    it("adds OpenRouter-specific headers", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "OR reply" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "deepseek/deepseek-chat",
        }),
      );

      const client = new AIClient({ provider: "openrouter", apiKey: "or-key" });
      await client.chat("sys", "hi");

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["HTTP-Referer"]).toBe("https://github.com/swarmmind");
      expect(opts.headers["X-Title"]).toBe("SwarmMind");
    });

    it("uses custom baseUrl for third-party relay", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "Relay" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "gpt-4o-mini",
        }),
      );

      const client = new AIClient({
        provider: "openai",
        apiKey: "relay-key",
        baseUrl: "https://my-relay.cn",
      });
      await client.chat("sys", "hi");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://my-relay.cn/v1/chat/completions");
    });
  });

  describe("structuredChat", () => {
    it("parses JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: '{"score": 7, "label": "high"}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "gpt-4o-mini",
        }),
      );

      const client = new AIClient({ provider: "openai", apiKey: "k" });
      const result = await client.structuredChat<{ score: number; label: string }>("sys", "eval");

      expect(result.score).toBe(7);
      expect(result.label).toBe("high");
    });

    it("strips markdown code blocks from JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: '```json\n{"value": 42}\n```' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "gpt-4o-mini",
        }),
      );

      const client = new AIClient({ provider: "openai", apiKey: "k" });
      const result = await client.structuredChat<{ value: number }>("sys", "q");

      expect(result.value).toBe(42);
    });

    it("throws on invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "not json at all" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "gpt-4o-mini",
        }),
      );

      const client = new AIClient({ provider: "openai", apiKey: "k" });
      await expect(client.structuredChat("sys", "q")).rejects.toThrow();
    });
  });

  describe("createAIClientFromEnv", () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it("creates anthropic client from env", () => {
      vi.stubEnv("AI_PROVIDER", "anthropic");
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");

      const client = createAIClientFromEnv();
      expect(client.getProvider()).toBe("anthropic");
    });

    it("creates openai client with custom model and baseUrl", () => {
      vi.stubEnv("AI_PROVIDER", "openai");
      vi.stubEnv("OPENAI_API_KEY", "sk-env");
      vi.stubEnv("AI_MODEL", "gpt-4o");
      vi.stubEnv("AI_BASE_URL", "https://relay.example.com");

      const client = createAIClientFromEnv();
      expect(client.getProvider()).toBe("openai");
      expect(client.getModel()).toBe("gpt-4o");
    });

    it("throws when API key is missing", () => {
      vi.stubEnv("AI_PROVIDER", "deepseek");
      delete process.env.DEEPSEEK_API_KEY;

      expect(() => createAIClientFromEnv()).toThrow("Missing DEEPSEEK_API_KEY");
    });

    it("defaults to anthropic when AI_PROVIDER not set", () => {
      delete process.env.AI_PROVIDER;
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");

      const client = createAIClientFromEnv();
      expect(client.getProvider()).toBe("anthropic");
    });
  });
});
