/**
 * Tests for DomainRouter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DomainRouter, SUPPORTED_DOMAINS } from "../router";
import type { AgentProposal } from "@swarmmind/shared";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProposal(
  overrides: Partial<AgentProposal> & { domain?: string } = {},
): AgentProposal {
  return {
    agentId: "agent-1",
    agentRole: "RISK",
    claim: "liquidation risk detected for WBTC/USDC position",
    confidence: 0.8,
    evidencePointers: ["0xabc123"],
    timestamp: Date.now(),
    ...overrides,
  } as AgentProposal;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DomainRouter", () => {
  let router: DomainRouter;

  beforeEach(() => {
    router = new DomainRouter({
      defaultConfig: {
        correlationDecay: 0.5,
        quorumThreshold: 0.3, // lower threshold for easier testing
        challengeWindowMs: 0,
      },
    });
  });

  describe("routeAndRun", () => {
    it("routes proposals with explicit domain field to correct domain", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", domain: "liquidation_risk", claim: "alert: position at risk" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "a2", domain: "liquidation_risk", claim: "alert: position at risk" } as AgentProposal & { domain: string }),
      ];

      const { results, skipped } = router.routeAndRun("round-1", proposals);

      expect(results.has("liquidation_risk")).toBe(true);
      expect(results.get("liquidation_risk")!.finalClaim).toBe("alert: position at risk");
      // Other domains had no proposals
      expect(skipped).toContain("pool_anomaly");
    });

    it("falls back to keyword classifier for proposals without domain field", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "pool anomaly detected: reserve imbalance in ETH/USDC" }),
        makeProposal({ agentId: "a2", claim: "pool anomaly detected: reserve imbalance in ETH/USDC" }),
      ];

      const { results } = router.routeAndRun("round-2", proposals);
      expect(results.has("pool_anomaly")).toBe(true);
    });

    it("routes cross_venue_spread proposals by keyword", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "cross-venue spread opportunity on BTC" }),
        makeProposal({ agentId: "a2", claim: "cross-venue spread opportunity on BTC" }),
      ];
      const { results } = router.routeAndRun("round-3", proposals);
      expect(results.has("cross_venue_spread")).toBe(true);
    });

    it("returns noConsensus for proposals that fail quorum", () => {
      // Two agents disagree, so no single claim reaches threshold
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "claim-A", domain: "contract_health" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "a2", claim: "claim-B", domain: "contract_health" } as AgentProposal & { domain: string }),
      ];

      const routerStrict = new DomainRouter({
        defaultConfig: { correlationDecay: 0, quorumThreshold: 0.9, challengeWindowMs: 0 },
      });

      const { results, noConsensus } = routerStrict.routeAndRun("round-4", proposals);
      expect(results.has("contract_health")).toBe(false);
      expect(noConsensus).toContain("contract_health");
    });

    it("skips domains with no proposals", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "news sentiment bearish", domain: "news_sentiment" } as AgentProposal & { domain: string }),
      ];

      const { skipped } = router.routeAndRun("round-5", proposals);
      expect(skipped).toContain("liquidation_risk");
      expect(skipped).toContain("pool_anomaly");
      expect(skipped).not.toContain("news_sentiment");
    });

    it("runs independent consensus per domain in the same call", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "liquidation risk high", domain: "liquidation_risk" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "a2", claim: "liquidation risk high", domain: "liquidation_risk" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "b1", claim: "pool anomaly: TVL drop", domain: "pool_anomaly" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "b2", claim: "pool anomaly: TVL drop", domain: "pool_anomaly" } as AgentProposal & { domain: string }),
      ];

      const { results } = router.routeAndRun("round-6", proposals);
      expect(results.size).toBe(2);
      expect(results.get("liquidation_risk")!.finalClaim).toBe("liquidation risk high");
      expect(results.get("pool_anomaly")!.finalClaim).toBe("pool anomaly: TVL drop");
    });

    it("produces deterministic commitHash and evidenceRoot", () => {
      const proposals: AgentProposal[] = [
        makeProposal({ agentId: "a1", claim: "alert", domain: "news_sentiment" } as AgentProposal & { domain: string }),
        makeProposal({ agentId: "a2", claim: "alert", domain: "news_sentiment" } as AgentProposal & { domain: string }),
      ];

      const { results: r1 } = router.routeAndRun("det-round", proposals);
      const { results: r2 } = router.routeAndRun("det-round", proposals);

      const res1 = r1.get("news_sentiment")!;
      const res2 = r2.get("news_sentiment")!;
      expect(res1.commitHash).toBe(res2.commitHash);
      expect(res1.evidenceRoot).toBe(res2.evidenceRoot);
    });
  });

  describe("reputation management", () => {
    it("defaults to weight 1.0 for unknown agents", () => {
      expect(router.getReputation("unknown-agent", "liquidation_risk")).toBe(1.0);
    });

    it("updates and reads domain-scoped reputation", () => {
      router.updateReputation("agent-x", "pool_anomaly", 1.5); // above default of 1.0
      const rep = router.getReputation("agent-x", "pool_anomaly");
      expect(rep).toBeGreaterThan(1.0); // EWMA shifts above 1.0 on 1.5 outcome from default 1.0
    });

    it("does not affect other domains when updating one", () => {
      router.updateReputation("agent-x", "pool_anomaly", 0.1); // very low outcome
      const other = router.getReputation("agent-x", "liquidation_risk");
      expect(other).toBe(1.0); // unchanged
    });

    it("snapshots all domain reputations", () => {
      router.updateReputation("agent-z", "contract_health", 0.8);
      const snap = router.snapshotReputations();
      expect(snap.contract_health.has("agent-z::contract_health")).toBe(true);
    });
  });

  describe("SUPPORTED_DOMAINS constant", () => {
    it("contains all five v1 domains", () => {
      expect(SUPPORTED_DOMAINS).toContain("liquidation_risk");
      expect(SUPPORTED_DOMAINS).toContain("pool_anomaly");
      expect(SUPPORTED_DOMAINS).toContain("cross_venue_spread");
      expect(SUPPORTED_DOMAINS).toContain("contract_health");
      expect(SUPPORTED_DOMAINS).toContain("news_sentiment");
      expect(SUPPORTED_DOMAINS.length).toBe(5);
    });
  });
});
