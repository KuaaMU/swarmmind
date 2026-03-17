/**
 * SwarmMind v1 – Core Protocol Data Structures
 *
 * This module defines the canonical v1 protocol types used across the entire
 * SwarmMind network: agents, consensus engine, verifier service, and on-chain
 * commitment layer.
 *
 * Every type is defined as a Zod schema (single source of truth) from which
 * the TypeScript interface is derived — providing both compile-time safety and
 * runtime validation at service boundaries.
 */

import { z } from "zod";
import { createHash } from "crypto";

// ─── Domain ───────────────────────────────────────────────────────────────────

/**
 * Supported intelligence domains.  Each domain maps to a distinct agent
 * specialisation and a separate reputation track in the consensus engine.
 */
export const DomainSchema = z.enum([
  "liquidation_risk",
  "pool_anomaly",
  "cross_venue_spread",
  "contract_health",
  "news_sentiment",
]);
export type Domain = z.infer<typeof DomainSchema>;

// ─── EvidencePointer ──────────────────────────────────────────────────────────

/**
 * A typed reference to a piece of evidence used to back an agent's claim.
 * The `hash` field is the SHA-256 digest of the evidence payload, enabling
 * independent verification without storing the full payload on-chain.
 */
export const EvidencePointerSchema = z.object({
  /** Categorises the evidence artifact for appropriate retrieval logic. */
  type: z.enum(["tx_hash", "block_range", "api_snapshot", "model_artifact"]),
  /** Content-addressable or service URI (ipfs://, https://, chain://…). */
  uri: z.string().min(1),
  /** SHA-256 hex digest of the evidence payload at `uri`. */
  hash: z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char hex SHA-256"),
  /** Unix epoch milliseconds when the evidence was captured. */
  timestamp: z.number().int().positive(),
});
export type EvidencePointer = z.infer<typeof EvidencePointerSchema>;

// ─── AgentProposal ────────────────────────────────────────────────────────────

/**
 * A proposal emitted by an agent for a specific consensus round.
 *
 * Each agent analyses the on-chain / off-chain data for its domain, forms a
 * `claim` string, attaches supporting `evidence`, and broadcasts this proposal
 * to the consensus layer.
 */
export const AgentProposalSchema = z.object({
  /** Unique identifier for this specific proposal (UUID v4 recommended). */
  proposalId: z.string().min(1),
  /** Stable identifier of the emitting agent. */
  agentId: z.string().min(1),
  /** Intelligence domain this proposal addresses. */
  domain: DomainSchema,
  /** Machine-readable statement — the agent's conclusion for this domain. */
  claim: z.string().min(1),
  /**
   * Agent's self-assessed confidence that `claim` is correct.
   * Range [0, 1] — 0 = no confidence, 1 = certain.
   */
  confidence: z.number().min(0).max(1),
  /** Expected value score for the proposed action (optional). */
  expectedValue: z.number().optional(),
  /** Aggregate risk score 0–100 associated with acting on this claim (optional). */
  riskScore: z.number().min(0).max(100).optional(),
  /** Evidence artifacts backing this proposal. */
  evidence: z.array(EvidencePointerSchema),
  /**
   * SHA-256 hex digest of the full off-chain reasoning trace.
   * The trace itself is stored off-chain (e.g. IPFS); only its hash is
   * broadcast so that the reasoning can be audited without bloating the
   * message bus.
   */
  traceHash: z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char hex SHA-256"),
  /** Unix epoch milliseconds when the proposal was created. */
  createdAt: z.number().int().positive(),
});
export type AgentProposal = z.infer<typeof AgentProposalSchema>;

// ─── ConsensusDecision ────────────────────────────────────────────────────────

/**
 * The final output of a consensus round.
 *
 * The `decisionHash` is a deterministic SHA-256 over the canonical decision
 * payload and is suitable for on-chain anchoring via `SwarmCommit.sol`.
 * The `evidenceRoot` is a Merkle root over all evidence pointer hashes
 * collected from the winning proposals.
 */
export const ConsensusDecisionSchema = z.object({
  /** Unique identifier for this decision (matches the consensus round ID). */
  decisionId: z.string().min(1),
  /** Intelligence domain this decision belongs to. */
  domain: DomainSchema,
  /** The winning claim chosen by the consensus engine. */
  finalClaim: z.string(),
  /** Aggregated confidence score [0, 1] for the winning claim. */
  finalScore: z.number().min(0).max(1),
  /** Ordered list of agentIds that participated in this round. */
  participants: z.array(z.string().min(1)),
  /** Per-agent adjusted score after reputation weighting + correlation penalty. */
  scoreVector: z.record(z.string(), z.number()),
  /**
   * Merkle root (SHA-256) computed over the sorted set of evidence pointer
   * hashes from all winning proposals.  Allows compact on-chain proof.
   */
  evidenceRoot: z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char hex SHA-256"),
  /**
   * SHA-256 hex digest of the canonical decision payload:
   *   SHA-256(decisionId + domain + finalClaim + finalScore + evidenceRoot)
   * This is the value submitted to `SwarmCommit.commitDecision`.
   */
  decisionHash: z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char hex SHA-256"),
  /** Unix epoch milliseconds when the decision was finalised. */
  createdAt: z.number().int().positive(),
});
export type ConsensusDecision = z.infer<typeof ConsensusDecisionSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the evidence Merkle root from an array of evidence pointer hashes.
 *
 * The algorithm is a simple binary Merkle tree over SHA-256 leaf digests:
 *  1. Sort the input hashes lexicographically for determinism.
 *  2. Pair and hash adjacent nodes; carry the last node up when odd count.
 *  3. Repeat until a single root remains.
 *
 * An empty evidence set returns the SHA-256 of the empty string.
 */
export function computeEvidenceRoot(evidenceHashes: readonly string[]): string {
  if (evidenceHashes.length === 0) {
    return createHash("sha256").update("").digest("hex");
  }

  // Leaf nodes: SHA-256 of each individual evidence hash
  let layer: string[] = [...evidenceHashes]
    .sort()
    .map((h) => createHash("sha256").update(h).digest("hex"));

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left; // duplicate last node when odd
      next.push(createHash("sha256").update(left + right).digest("hex"));
    }
    layer = next;
  }

  return layer[0]!;
}

/**
 * Compute the canonical decision hash for on-chain commitment.
 *
 * SHA-256(decisionId + "::" + domain + "::" + finalClaim + "::" +
 *          finalScore.toFixed(8) + "::" + evidenceRoot)
 */
export function computeDecisionHash(
  decisionId: string,
  domain: Domain,
  finalClaim: string,
  finalScore: number,
  evidenceRoot: string,
): string {
  const payload = [decisionId, domain, finalClaim, finalScore.toFixed(8), evidenceRoot].join("::");
  return createHash("sha256").update(payload).digest("hex");
}
