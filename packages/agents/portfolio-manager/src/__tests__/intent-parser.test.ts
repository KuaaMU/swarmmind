import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntentParser } from "../services/intent-parser";
import type { AIClient, UserStrategy } from "@swarmmind/shared";

function createMockAI(): AIClient {
  return {
    structuredChat: vi.fn().mockResolvedValue({
      riskTolerance: "LOW",
      maxPositionSize: 50,
      preferredTokens: ["OKB"],
      strategyType: "CONSERVATIVE",
      constraints: ["no leverage"],
    }),
    chat: vi.fn(),
    getProvider: vi.fn().mockReturnValue("anthropic"),
    getModel: vi.fn().mockReturnValue("claude-haiku-4-5"),
  } as unknown as AIClient;
}

describe("IntentParser", () => {
  let parser: IntentParser;
  let mockAI: AIClient;

  beforeEach(() => {
    mockAI = createMockAI();
    parser = new IntentParser(mockAI);
  });

  describe("parseStrategy", () => {
    it("parses user strategy text via AI", async () => {
      const result = await parser.parseStrategy("I want low risk trades on OKB with max $50");

      expect(result.riskTolerance).toBe("LOW");
      expect(result.maxPositionSize).toBe(50);
      expect(result.preferredTokens).toEqual(["OKB"]);
      expect(result.strategyType).toBe("CONSERVATIVE");
      expect(result.constraints).toEqual(["no leverage"]);
    });

    it("returns default strategy for empty input", async () => {
      const result = await parser.parseStrategy("");

      expect(result.riskTolerance).toBe("MEDIUM");
      expect(result.maxPositionSize).toBe(100);
      expect(result.preferredTokens).toEqual(["OKB", "USDC"]);
      expect(result.strategyType).toBe("BALANCED");
      expect(mockAI.structuredChat).not.toHaveBeenCalled();
    });

    it("returns default strategy for whitespace-only input", async () => {
      const result = await parser.parseStrategy("   ");

      expect(result.riskTolerance).toBe("MEDIUM");
      expect(mockAI.structuredChat).not.toHaveBeenCalled();
    });

    it("validates risk tolerance to allowed values", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskTolerance: "EXTREME",
        maxPositionSize: 100,
        preferredTokens: ["OKB"],
        strategyType: "BALANCED",
        constraints: [],
      });

      const result = await parser.parseStrategy("go extreme");

      expect(result.riskTolerance).toBe("MEDIUM"); // falls back to default
    });

    it("validates strategy type to allowed values", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskTolerance: "HIGH",
        maxPositionSize: 200,
        preferredTokens: ["WETH"],
        strategyType: "YOLO",
        constraints: [],
      });

      const result = await parser.parseStrategy("yolo mode");

      expect(result.strategyType).toBe("BALANCED"); // falls back
      expect(result.riskTolerance).toBe("HIGH"); // valid, kept
    });

    it("defaults maxPositionSize when invalid", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskTolerance: "MEDIUM",
        maxPositionSize: -50,
        preferredTokens: [],
        strategyType: "BALANCED",
        constraints: [],
      });

      const result = await parser.parseStrategy("normal strategy");

      expect(result.maxPositionSize).toBe(100);
    });

    it("defaults preferredTokens when empty", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskTolerance: "HIGH",
        maxPositionSize: 300,
        preferredTokens: [],
        strategyType: "AGGRESSIVE",
        constraints: [],
      });

      const result = await parser.parseStrategy("aggressive");

      expect(result.preferredTokens).toEqual(["OKB", "USDC"]);
    });
  });
});
