import { describe, it, expect, beforeEach } from "vitest";
import { LiquidityAgent } from "../liquidity-agent";
import type { LiquidityPool } from "@swarmmind/shared";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePool(overrides: Partial<LiquidityPool> = {}): LiquidityPool {
  return {
    poolAddress: "0xpool1",
    tokenPair: "ETH/USDC",
    reserveA: 1000,
    reserveB: 2_000_000,
    tvlUsd: 4_000_000,
    volume24hUsd: 200_000,
    apy: 0.08,
    utilization: 0.6,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("LiquidityAgent.assess", () => {
  let agent: LiquidityAgent;

  beforeEach(() => {
    agent = new LiquidityAgent({ deepImpactBps: 10, adequateImpactBps: 50 });
  });

  it("assigns DEEP to a high-TVL pool with minimal price impact", () => {
    const pool = makePool({ tvlUsd: 10_000_000 });
    const result = agent.assess(pool);
    // $10k trade / (2 × $10M) × 10000 bps = 5 bps → DEEP
    expect(result.recommendation).toBe("DEEP");
    expect(result.priceImpactBps).toBeLessThanOrEqual(10);
    expect(result.liquidityScore).toBeGreaterThanOrEqual(7);
  });

  it("assigns ADEQUATE to a medium-TVL pool", () => {
    // $10k / (2 × $1M) × 10000 = 50 bps (right at the boundary)
    const pool = makePool({ tvlUsd: 1_000_000 });
    const result = agent.assess(pool);
    expect(["DEEP", "ADEQUATE"]).toContain(result.recommendation);
  });

  it("assigns AVOID to a pool below minimum TVL", () => {
    const pool = makePool({ tvlUsd: 50_000 }); // below default 100k
    const result = agent.assess(pool);
    expect(result.recommendation).toBe("AVOID");
    expect(result.liquidityScore).toBe(1);
  });

  it("assigns SHALLOW to a pool with high price impact", () => {
    // $10k / (2 × $100k) × 10000 = 500 bps → SHALLOW
    const pool = makePool({ tvlUsd: 100_000 });
    const result = agent.assess(pool);
    expect(["SHALLOW", "ADEQUATE"]).toContain(result.recommendation);
    expect(result.priceImpactBps).toBeGreaterThan(10);
  });

  it("populates rationale string with key metrics", () => {
    const pool = makePool({ tvlUsd: 4_000_000 });
    const result = agent.assess(pool);
    expect(result.rationale).toContain("ETH/USDC");
    expect(result.rationale).toContain("bps");
    expect(result.rationale).toContain("/10");
  });

  it("caches assessments and returns count", () => {
    agent.assess(makePool());
    agent.assess(makePool({ poolAddress: "0xpool2" }));
    expect(agent.getAssessmentCount()).toBe(2);
    expect(agent.getRecentAssessments()).toHaveLength(2);
  });

  it("rejects invalid pool data (Zod validation)", () => {
    expect(() => agent.assess({ poolAddress: "" })).toThrow();
    expect(() => agent.assess({ ...makePool(), utilization: 1.5 })).toThrow();
  });
});

describe("LiquidityAgent.assessAndPropose", () => {
  it("returns assessment and a valid AgentProposal", () => {
    const agent = new LiquidityAgent();
    const pool = makePool({ tvlUsd: 5_000_000 });
    const { assessment, proposal } = agent.assessAndPropose(pool);
    expect(proposal.agentRole).toBe("LIQUIDITY");
    expect(proposal.claim).toBe(assessment.recommendation);
    expect(proposal.confidence).toBeGreaterThan(0);
    expect(proposal.confidence).toBeLessThanOrEqual(1);
    expect(proposal.evidencePointers).toContain("0xpool1");
  });
});

describe("LiquidityAgent – integration with ConsensusEngine", () => {
  it("produces proposals that can be fed into ConsensusEngine", async () => {
    const { ConsensusEngine } = await import("@swarmmind/consensus");
    const agent1 = new LiquidityAgent({ agentId: "liq-1", deepImpactBps: 10, adequateImpactBps: 50 });
    const agent2 = new LiquidityAgent({ agentId: "liq-2", deepImpactBps: 10, adequateImpactBps: 50 });
    const engine = new ConsensusEngine(undefined, { challengeWindowMs: 0 });

    const pool = makePool({ tvlUsd: 8_000_000 });
    const { proposal: p1 } = agent1.assessAndPropose(pool);
    const { proposal: p2 } = agent2.assessAndPropose(pool);

    const result = engine.run("liq-consensus-round", [p1, p2]);
    expect(result.finalClaim).toBeTruthy();
    expect(result.totalProposals).toBe(2);
  });
});
