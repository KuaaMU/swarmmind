import { describe, it, expect, vi, beforeEach } from "vitest";
import { RiskEvaluator } from "../services/risk-evaluator";
import type { AIClient } from "@swarmmind/shared";
import { VolatilityCalculator } from "../services/volatility-calculator";
import type { TradingSignal } from "@swarmmind/shared";

function createMockAI(): AIClient {
  return {
    structuredChat: vi.fn().mockResolvedValue({
      riskScore: 4,
      maxDrawdown: 8.5,
      recommendation: "PROCEED",
      rationale: "Low risk based on market conditions",
    }),
    chat: vi.fn(),
    getProvider: vi.fn().mockReturnValue("anthropic"),
    getModel: vi.fn().mockReturnValue("claude-haiku-4-5"),
  } as unknown as AIClient;
}

function createTestSignal(overrides: Partial<TradingSignal> = {}): TradingSignal {
  return {
    id: "sig-001",
    type: "MOMENTUM",
    tokenPair: "OKB/USDC",
    direction: "BUY",
    confidence: 0.8,
    entryPrice: 52.0,
    targetPrice: 55.0,
    stopLoss: 50.0,
    rationale: "Strong upward momentum",
    timestamp: Date.now(),
    source: "alpha-scout",
    ...overrides,
  };
}

describe("RiskEvaluator", () => {
  let evaluator: RiskEvaluator;
  let mockAI: AIClient;
  let volatilityCalc: VolatilityCalculator;

  beforeEach(() => {
    mockAI = createMockAI();
    volatilityCalc = new VolatilityCalculator();
    evaluator = new RiskEvaluator(mockAI, volatilityCalc);
  });

  describe("assessTrade", () => {
    it("returns risk assessment from AI analysis", async () => {
      const signal = createTestSignal();
      const result = await evaluator.assessTrade(signal);

      expect(result.signalId).toBe("sig-001");
      expect(result.riskScore).toBe(4);
      expect(result.maxDrawdown).toBe(8.5);
      expect(result.recommendation).toBe("PROCEED");
      expect(result.rationale).toBe("Low risk based on market conditions");
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("clamps risk score to 1-10 range", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: 15,
        maxDrawdown: 5,
        recommendation: "CAUTION",
        rationale: "High",
      });

      const result = await evaluator.assessTrade(createTestSignal());
      expect(result.riskScore).toBe(10);
    });

    it("clamps low risk score to minimum 1", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: -2,
        maxDrawdown: 0,
        recommendation: "PROCEED",
        rationale: "Very safe",
      });

      const result = await evaluator.assessTrade(createTestSignal());
      expect(result.riskScore).toBe(1);
    });

    it("normalizes unknown recommendation to CAUTION", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: 5,
        maxDrawdown: 3,
        recommendation: "MAYBE",
        rationale: "Uncertain",
      });

      const result = await evaluator.assessTrade(createTestSignal());
      expect(result.recommendation).toBe("CAUTION");
    });

    it("caches assessments", async () => {
      await evaluator.assessTrade(createTestSignal({ id: "sig-1" }));
      await evaluator.assessTrade(createTestSignal({ id: "sig-2" }));

      expect(evaluator.getAssessmentCount()).toBe(2);
      expect(evaluator.getRecentAssessments()).toHaveLength(2);
    });

    it("provides default rationale when missing", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: 3,
        maxDrawdown: 2,
        recommendation: "PROCEED",
        rationale: "",
      });

      const result = await evaluator.assessTrade(createTestSignal());
      expect(result.rationale).toBe("No rationale provided");
    });
  });

  describe("getAssessmentById", () => {
    it("finds assessment by signal ID", async () => {
      await evaluator.assessTrade(createTestSignal({ id: "target-id" }));

      const found = evaluator.getAssessmentById("target-id");
      expect(found).toBeDefined();
      expect(found!.signalId).toBe("target-id");
    });

    it("returns undefined for unknown signal ID", () => {
      expect(evaluator.getAssessmentById("nonexistent")).toBeUndefined();
    });
  });

  describe("cache limit", () => {
    it("trims cache to 50 entries", async () => {
      for (let i = 0; i < 55; i++) {
        await evaluator.assessTrade(createTestSignal({ id: `sig-${i}` }));
      }

      expect(evaluator.getAssessmentCount()).toBe(50);
      // First 5 should be evicted
      expect(evaluator.getAssessmentById("sig-0")).toBeUndefined();
      expect(evaluator.getAssessmentById("sig-54")).toBeDefined();
    });
  });

  describe("assessAndPropose", () => {
    it("returns both assessment and proposal", async () => {
      const signal = createTestSignal();
      const { assessment, proposal } = await evaluator.assessAndPropose(signal);

      expect(assessment.signalId).toBe("sig-001");
      expect(proposal.agentId).toBe("risk-oracle");
      expect(proposal.agentRole).toBe("RISK");
      expect(proposal.claim).toBe("PROCEED");
      expect(proposal.evidencePointers).toContain("sig-001");
      expect(proposal.evidencePointers).toContain("OKB/USDC");
    });

    it("confidence is inverse of risk score (riskScore=1 → confidence=1.0)", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: 1,
        maxDrawdown: 0,
        recommendation: "PROCEED",
        rationale: "Safe",
      });
      const { proposal } = await evaluator.assessAndPropose(createTestSignal());
      expect(proposal.confidence).toBe(1.0);
    });

    it("confidence is inverse of risk score (riskScore=10 → confidence=0.0)", async () => {
      (mockAI.structuredChat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        riskScore: 10,
        maxDrawdown: 50,
        recommendation: "REJECT",
        rationale: "Very risky",
      });
      const { proposal } = await evaluator.assessAndPropose(createTestSignal());
      expect(proposal.confidence).toBe(0.0);
    });

    it("uses custom agentId when provided", async () => {
      const customEvaluator = new RiskEvaluator(mockAI, volatilityCalc, "my-risk-agent");
      const { proposal } = await customEvaluator.assessAndPropose(createTestSignal());
      expect(proposal.agentId).toBe("my-risk-agent");
    });

    it("also adds assessment to cache", async () => {
      await evaluator.assessAndPropose(createTestSignal({ id: "propose-sig" }));
      expect(evaluator.getAssessmentById("propose-sig")).toBeDefined();
    });
  });
});
