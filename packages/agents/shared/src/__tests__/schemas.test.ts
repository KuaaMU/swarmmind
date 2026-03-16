import { describe, it, expect } from "vitest";
import {
  AgentRoleSchema,
  AgentInfoSchema,
  TradingSignalSchema,
  RiskAssessmentSchema,
  LiquidityPoolSchema,
  LiquidityAssessmentSchema,
  AgentProposalSchema,
  ConsensusResultSchema,
  WsMessageSchema,
  UserStrategySchema,
  ApiResponseSchema,
} from "../schemas";
import { z } from "zod";

describe("AgentRoleSchema", () => {
  it("accepts valid roles", () => {
    expect(AgentRoleSchema.parse("SCOUT")).toBe("SCOUT");
    expect(AgentRoleSchema.parse("RISK")).toBe("RISK");
    expect(AgentRoleSchema.parse("LIQUIDITY")).toBe("LIQUIDITY");
  });
  it("rejects unknown role", () => {
    expect(() => AgentRoleSchema.parse("UNKNOWN")).toThrow();
  });
});

describe("TradingSignalSchema", () => {
  const valid = {
    id: "sig-1",
    type: "ARBITRAGE",
    tokenPair: "ETH/USDC",
    direction: "BUY",
    confidence: 0.85,
    entryPrice: 2000,
    targetPrice: 2200,
    stopLoss: 1900,
    rationale: "price spread detected",
    timestamp: Date.now(),
    source: "alpha-scout",
  } as const;

  it("parses a valid signal", () => {
    const result = TradingSignalSchema.parse(valid);
    expect(result.id).toBe("sig-1");
    expect(result.confidence).toBe(0.85);
  });

  it("rejects confidence > 1", () => {
    expect(() => TradingSignalSchema.parse({ ...valid, confidence: 1.5 })).toThrow();
  });

  it("rejects negative entryPrice", () => {
    expect(() => TradingSignalSchema.parse({ ...valid, entryPrice: -1 })).toThrow();
  });
});

describe("RiskAssessmentSchema", () => {
  const valid = {
    signalId: "sig-1",
    riskScore: 7,
    maxDrawdown: 0.15,
    recommendation: "CAUTION",
    rationale: "medium volatility",
    timestamp: Date.now(),
  } as const;

  it("parses a valid assessment", () => {
    expect(RiskAssessmentSchema.parse(valid).riskScore).toBe(7);
  });

  it("rejects riskScore out of 1-10 range", () => {
    expect(() => RiskAssessmentSchema.parse({ ...valid, riskScore: 0 })).toThrow();
    expect(() => RiskAssessmentSchema.parse({ ...valid, riskScore: 11 })).toThrow();
  });
});

describe("LiquidityPoolSchema", () => {
  const valid = {
    poolAddress: "0xabc",
    tokenPair: "ETH/USDC",
    reserveA: 100,
    reserveB: 200000,
    tvlUsd: 400000,
    volume24hUsd: 50000,
    apy: 0.08,
    utilization: 0.6,
    timestamp: Date.now(),
  } as const;

  it("parses a valid pool", () => {
    expect(LiquidityPoolSchema.parse(valid).tvlUsd).toBe(400000);
  });

  it("rejects utilization > 1", () => {
    expect(() => LiquidityPoolSchema.parse({ ...valid, utilization: 1.1 })).toThrow();
  });
});

describe("LiquidityAssessmentSchema", () => {
  it("accepts valid assessment", () => {
    const a = LiquidityAssessmentSchema.parse({
      poolAddress: "0xabc",
      liquidityScore: 8,
      priceImpactBps: 15,
      recommendation: "DEEP",
      rationale: "high TVL",
      timestamp: Date.now(),
    });
    expect(a.recommendation).toBe("DEEP");
  });
});

describe("AgentProposalSchema", () => {
  const valid = {
    agentId: "risk-agent-1",
    agentRole: "RISK",
    claim: "ETH/USDC pool is risky",
    confidence: 0.9,
    evidencePointers: ["0xabc123"],
    timestamp: Date.now(),
  } as const;

  it("parses a valid proposal", () => {
    expect(AgentProposalSchema.parse(valid).agentId).toBe("risk-agent-1");
  });

  it("rejects confidence out of range", () => {
    expect(() => AgentProposalSchema.parse({ ...valid, confidence: -0.1 })).toThrow();
  });
});

describe("ConsensusResultSchema", () => {
  it("parses a valid result", () => {
    const result = ConsensusResultSchema.parse({
      roundId: "round-1",
      finalClaim: "REJECT",
      weightedScore: 0.75,
      supportCount: 3,
      totalProposals: 4,
      contributions: [
        { agentId: "a1", rawConfidence: 0.9, weight: 1.0, penalizedWeight: 0.85, included: true },
      ],
      challengeOpen: true,
      challengeExpiresAt: Date.now() + 86400000,
      timestamp: Date.now(),
    });
    expect(result.finalClaim).toBe("REJECT");
    expect(result.contributions).toHaveLength(1);
  });
});

describe("WsMessageSchema", () => {
  it("accepts CONSENSUS_REACHED", () => {
    const msg = WsMessageSchema.parse({
      type: "CONSENSUS_REACHED",
      data: { roundId: "r1" },
      timestamp: Date.now(),
    });
    expect(msg.type).toBe("CONSENSUS_REACHED");
  });
});

describe("UserStrategySchema", () => {
  it("parses a valid strategy", () => {
    const s = UserStrategySchema.parse({
      riskTolerance: "MEDIUM",
      maxPositionSize: 10000,
      preferredTokens: ["ETH", "USDC"],
      strategyType: "BALANCED",
      constraints: ["no leverage"],
    });
    expect(s.riskTolerance).toBe("MEDIUM");
  });
});

describe("ApiResponseSchema", () => {
  it("parses a typed API response", () => {
    const RiskResponseSchema = ApiResponseSchema(RiskAssessmentSchema);
    const r = RiskResponseSchema.parse({
      success: true,
      data: {
        signalId: "sig-1",
        riskScore: 5,
        maxDrawdown: 0.1,
        recommendation: "PROCEED",
        rationale: "low risk",
        timestamp: Date.now(),
      },
      error: null,
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
    expect(r.data?.riskScore).toBe(5);
  });

  it("parses a null data error response", () => {
    const R = ApiResponseSchema(z.string());
    const r = R.parse({ success: false, data: null, error: "not found", timestamp: Date.now() });
    expect(r.success).toBe(false);
    expect(r.data).toBeNull();
  });
});
