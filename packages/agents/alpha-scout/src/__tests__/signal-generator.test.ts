import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalGenerator } from "../services/signal-generator";
import type { AIClient, TokenPrice } from "@swarmmind/shared";

function createMockAI(): AIClient {
  return {
    structuredChat: vi.fn().mockResolvedValue({
      signals: [
        {
          type: "MOMENTUM",
          tokenPair: "OKB/USDC",
          direction: "BUY",
          confidence: 0.85,
          entryPrice: 52.0,
          targetPrice: 55.0,
          stopLoss: 50.0,
          rationale: "Strong upward momentum detected",
        },
      ],
    }),
    chat: vi.fn(),
    getProvider: vi.fn().mockReturnValue("openai"),
    getModel: vi.fn().mockReturnValue("gpt-4o-mini"),
  } as unknown as AIClient;
}

function createTestPrices(): TokenPrice[] {
  return [
    { chainIndex: "196", tokenAddress: "0x1", tokenSymbol: "OKB", price: "52.3", volume24h: "1000000", change24h: "2.5" },
    { chainIndex: "196", tokenAddress: "0x2", tokenSymbol: "WETH", price: "3500", volume24h: "500000", change24h: "-1.2" },
  ];
}

describe("SignalGenerator", () => {
  let generator: SignalGenerator;
  let mockAI: AIClient;

  beforeEach(() => {
    mockAI = createMockAI();
    generator = new SignalGenerator(mockAI);
  });

  describe("analyzeMarket", () => {
    it("generates trading signals from market data", async () => {
      const signals = await generator.analyzeMarket(createTestPrices());

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe("MOMENTUM");
      expect(signals[0].tokenPair).toBe("OKB/USDC");
      expect(signals[0].direction).toBe("BUY");
      expect(signals[0].confidence).toBe(0.85);
      expect(signals[0].source).toBe("alpha-scout");
      expect(signals[0].id).toBeTruthy();
    });

    it("returns empty array for empty price data", async () => {
      const signals = await generator.analyzeMarket([]);

      expect(signals).toEqual([]);
      expect(mockAI.structuredChat).not.toHaveBeenCalled();
    });

    it("returns empty array on AI error", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("API rate limit"),
      );

      const signals = await generator.analyzeMarket(createTestPrices());

      expect(signals).toEqual([]);
    });

    it("clamps confidence to 0-1 range", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        signals: [
          {
            type: "ARBITRAGE",
            tokenPair: "OKB/USDC",
            direction: "BUY",
            confidence: 1.5,
            entryPrice: 52,
            targetPrice: 55,
            stopLoss: 50,
            rationale: "test",
          },
        ],
      });

      const signals = await generator.analyzeMarket(createTestPrices());

      expect(signals[0].confidence).toBe(1);
    });

    it("filters out invalid signals", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        signals: [
          {
            type: "INVALID_TYPE",
            tokenPair: "OKB/USDC",
            direction: "BUY",
            confidence: 0.5,
            entryPrice: 52,
            targetPrice: 55,
            stopLoss: 50,
            rationale: "test",
          },
          {
            type: "MOMENTUM",
            tokenPair: "OKB/USDC",
            direction: "BUY",
            confidence: 0.7,
            entryPrice: 52,
            targetPrice: 55,
            stopLoss: 50,
            rationale: "valid",
          },
        ],
      });

      const signals = await generator.analyzeMarket(createTestPrices());

      expect(signals).toHaveLength(1);
      expect(signals[0].rationale).toBe("valid");
    });

    it("stores signals in memory", async () => {
      await generator.analyzeMarket(createTestPrices());
      await generator.analyzeMarket(createTestPrices());

      expect(generator.getSignalCount()).toBe(2);
    });
  });

  describe("getLatestSignals", () => {
    it("returns last N signals", async () => {
      await generator.analyzeMarket(createTestPrices());
      await generator.analyzeMarket(createTestPrices());

      const latest = generator.getLatestSignals(1);
      expect(latest).toHaveLength(1);
    });
  });

  describe("getSignalsByType", () => {
    it("filters signals by type", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          signals: [
            { type: "MOMENTUM", tokenPair: "A/B", direction: "BUY", confidence: 0.5, entryPrice: 1, targetPrice: 2, stopLoss: 0.5, rationale: "m" },
          ],
        })
        .mockResolvedValueOnce({
          signals: [
            { type: "ARBITRAGE", tokenPair: "C/D", direction: "SELL", confidence: 0.6, entryPrice: 3, targetPrice: 2.5, stopLoss: 3.5, rationale: "a" },
          ],
        });

      await generator.analyzeMarket(createTestPrices());
      await generator.analyzeMarket(createTestPrices());

      const arbitrage = generator.getSignalsByType("ARBITRAGE");
      expect(arbitrage).toHaveLength(1);
      expect(arbitrage[0].tokenPair).toBe("C/D");
    });
  });
});
