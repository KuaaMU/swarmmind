import { describe, it, expect } from "vitest";
import {
  DomainSchema,
  EvidencePointerSchema,
  AgentProposalSchema,
  ConsensusDecisionSchema,
  computeEvidenceRoot,
  computeDecisionHash,
} from "../protocol";
import type { Domain, EvidencePointer, AgentProposal, ConsensusDecision } from "../protocol";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_HASH = "a".repeat(64);
const VALID_HASH_2 = "b".repeat(64);

function makeEvidencePointer(overrides: Partial<EvidencePointer> = {}): EvidencePointer {
  return {
    type: "tx_hash",
    uri: "chain://xlayer/tx/0xabc",
    hash: VALID_HASH,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    proposalId: "proposal-001",
    agentId: "risk-agent-1",
    domain: "liquidation_risk",
    claim: "HIGH_RISK_DETECTED",
    confidence: 0.85,
    expectedValue: -0.12,
    riskScore: 78,
    evidence: [makeEvidencePointer()],
    traceHash: VALID_HASH,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<ConsensusDecision> = {}): ConsensusDecision {
  return {
    decisionId: "round-001",
    domain: "liquidation_risk",
    finalClaim: "HIGH_RISK_DETECTED",
    finalScore: 0.82,
    participants: ["risk-agent-1", "risk-agent-2"],
    scoreVector: { "risk-agent-1": 0.9, "risk-agent-2": 0.74 },
    evidenceRoot: VALID_HASH,
    decisionHash: VALID_HASH_2,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

// ─── DomainSchema ─────────────────────────────────────────────────────────────

describe("DomainSchema", () => {
  const validDomains: Domain[] = [
    "liquidation_risk",
    "pool_anomaly",
    "cross_venue_spread",
    "contract_health",
    "news_sentiment",
  ];

  it.each(validDomains)("accepts valid domain %s", (domain) => {
    expect(DomainSchema.parse(domain)).toBe(domain);
  });

  it("rejects an unknown domain", () => {
    expect(() => DomainSchema.parse("unknown_domain")).toThrow();
  });
});

// ─── EvidencePointerSchema ────────────────────────────────────────────────────

describe("EvidencePointerSchema", () => {
  it("parses a valid evidence pointer", () => {
    const ep = makeEvidencePointer();
    const parsed = EvidencePointerSchema.parse(ep);
    expect(parsed.type).toBe("tx_hash");
    expect(parsed.hash).toBe(VALID_HASH);
  });

  it("accepts all evidence types", () => {
    const types: EvidencePointer["type"][] = [
      "tx_hash",
      "block_range",
      "api_snapshot",
      "model_artifact",
    ];
    for (const type of types) {
      expect(() => EvidencePointerSchema.parse(makeEvidencePointer({ type }))).not.toThrow();
    }
  });

  it("rejects a hash that is not 64 hex chars", () => {
    expect(() => EvidencePointerSchema.parse(makeEvidencePointer({ hash: "abc123" }))).toThrow();
    expect(() =>
      EvidencePointerSchema.parse(makeEvidencePointer({ hash: "z".repeat(64) })),
    ).toThrow();
  });

  it("rejects an empty uri", () => {
    expect(() => EvidencePointerSchema.parse(makeEvidencePointer({ uri: "" }))).toThrow();
  });

  it("rejects a non-positive timestamp", () => {
    expect(() => EvidencePointerSchema.parse(makeEvidencePointer({ timestamp: 0 }))).toThrow();
    expect(() => EvidencePointerSchema.parse(makeEvidencePointer({ timestamp: -1 }))).toThrow();
  });
});

// ─── AgentProposalSchema ──────────────────────────────────────────────────────

describe("AgentProposalSchema", () => {
  it("parses a fully-populated proposal", () => {
    const proposal = makeProposal();
    const parsed = AgentProposalSchema.parse(proposal);
    expect(parsed.proposalId).toBe("proposal-001");
    expect(parsed.domain).toBe("liquidation_risk");
    expect(parsed.confidence).toBe(0.85);
  });

  it("allows optional fields to be absent", () => {
    const { expectedValue: _ev, riskScore: _rs, ...minimal } = makeProposal();
    expect(() => AgentProposalSchema.parse(minimal)).not.toThrow();
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(() => AgentProposalSchema.parse(makeProposal({ confidence: 1.1 }))).toThrow();
    expect(() => AgentProposalSchema.parse(makeProposal({ confidence: -0.1 }))).toThrow();
  });

  it("rejects riskScore outside [0, 100]", () => {
    expect(() => AgentProposalSchema.parse(makeProposal({ riskScore: 101 }))).toThrow();
    expect(() => AgentProposalSchema.parse(makeProposal({ riskScore: -1 }))).toThrow();
  });

  it("rejects an invalid traceHash", () => {
    expect(() => AgentProposalSchema.parse(makeProposal({ traceHash: "short" }))).toThrow();
  });

  it("accepts multiple evidence pointers", () => {
    const ep2 = makeEvidencePointer({ type: "block_range", uri: "chain://xlayer/blocks/100-200" });
    const parsed = AgentProposalSchema.parse(makeProposal({ evidence: [makeEvidencePointer(), ep2] }));
    expect(parsed.evidence).toHaveLength(2);
  });

  it("accepts empty evidence array", () => {
    expect(() => AgentProposalSchema.parse(makeProposal({ evidence: [] }))).not.toThrow();
  });
});

// ─── ConsensusDecisionSchema ──────────────────────────────────────────────────

describe("ConsensusDecisionSchema", () => {
  it("parses a valid consensus decision", () => {
    const decision = makeDecision();
    const parsed = ConsensusDecisionSchema.parse(decision);
    expect(parsed.decisionId).toBe("round-001");
    expect(parsed.finalScore).toBe(0.82);
    expect(parsed.participants).toHaveLength(2);
  });

  it("rejects finalScore outside [0, 1]", () => {
    expect(() => ConsensusDecisionSchema.parse(makeDecision({ finalScore: 1.5 }))).toThrow();
    expect(() => ConsensusDecisionSchema.parse(makeDecision({ finalScore: -0.1 }))).toThrow();
  });

  it("rejects an invalid evidenceRoot", () => {
    expect(() =>
      ConsensusDecisionSchema.parse(makeDecision({ evidenceRoot: "not-a-hash" })),
    ).toThrow();
  });

  it("rejects an invalid decisionHash", () => {
    expect(() =>
      ConsensusDecisionSchema.parse(makeDecision({ decisionHash: "not-a-hash" })),
    ).toThrow();
  });

  it("accepts empty scoreVector", () => {
    expect(() => ConsensusDecisionSchema.parse(makeDecision({ scoreVector: {} }))).not.toThrow();
  });
});

// ─── computeEvidenceRoot ──────────────────────────────────────────────────────

describe("computeEvidenceRoot", () => {
  it("returns the SHA-256 of empty string for an empty array", () => {
    const root = computeEvidenceRoot([]);
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(root).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(root).toHaveLength(64);
  });

  it("produces a 64-char hex root for a single evidence hash", () => {
    const root = computeEvidenceRoot([VALID_HASH]);
    expect(root).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same root regardless of input order (deterministic)", () => {
    const h1 = "1".repeat(64);
    const h2 = "2".repeat(64);
    const root1 = computeEvidenceRoot([h1, h2]);
    const root2 = computeEvidenceRoot([h2, h1]);
    expect(root1).toBe(root2);
  });

  it("produces different roots for different evidence sets", () => {
    const root1 = computeEvidenceRoot([VALID_HASH]);
    const root2 = computeEvidenceRoot([VALID_HASH_2]);
    expect(root1).not.toBe(root2);
  });

  it("handles an odd number of evidence hashes without error", () => {
    const hashes = ["1".repeat(64), "2".repeat(64), "3".repeat(64)];
    expect(() => computeEvidenceRoot(hashes)).not.toThrow();
    expect(computeEvidenceRoot(hashes)).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── computeDecisionHash ─────────────────────────────────────────────────────

describe("computeDecisionHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = computeDecisionHash("round-001", "liquidation_risk", "HIGH_RISK", 0.82, VALID_HASH);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", () => {
    const h1 = computeDecisionHash("r1", "pool_anomaly", "ANOMALY_DETECTED", 0.9, VALID_HASH);
    const h2 = computeDecisionHash("r1", "pool_anomaly", "ANOMALY_DETECTED", 0.9, VALID_HASH);
    expect(h1).toBe(h2);
  });

  it("changes when any input changes", () => {
    const base = computeDecisionHash("r1", "pool_anomaly", "CLAIM", 0.9, VALID_HASH);
    expect(computeDecisionHash("r2", "pool_anomaly", "CLAIM", 0.9, VALID_HASH)).not.toBe(base);
    expect(computeDecisionHash("r1", "contract_health", "CLAIM", 0.9, VALID_HASH)).not.toBe(base);
    expect(computeDecisionHash("r1", "pool_anomaly", "OTHER", 0.9, VALID_HASH)).not.toBe(base);
    expect(computeDecisionHash("r1", "pool_anomaly", "CLAIM", 0.8, VALID_HASH)).not.toBe(base);
    expect(computeDecisionHash("r1", "pool_anomaly", "CLAIM", 0.9, VALID_HASH_2)).not.toBe(base);
  });
});
