/**
 * SwarmMind v1 – Consensus Engine
 *
 * Implements the CRCN (Challenge-Responsive Consensus Network) model:
 *
 *  1. Proposal Layer  – agents submit AgentProposals (claim + confidence + evidence)
 *  2. Consensus Layer – weighted voting + correlation penalty (penalize same-role Sybil clusters)
 *  3. Commit Layer    – deterministic commit hash for on-chain anchoring
 *  4. Challenge Layer – challenge window signalling (enforcement is on-chain)
 *
 * Algorithm
 * ---------
 * For each unique claim, we sum (weight × penalizedConfidence) across proposals.
 * The claim with the highest aggregate score wins.
 *
 * Correlation Penalty:
 *   When multiple agents from the SAME role submit the SAME claim, their combined
 *   weight is dampened. Specifically, the k-th correlated agent from a group
 *   receives a multiplier of  1 / (1 + CORRELATION_DECAY × (k-1)).
 *
 * Agent Weight:
 *   Sourced from the ReputationRegistry (domain-specific EWMA scores). Falls
 *   back to DEFAULT_WEIGHT = 1.0 when no reputation data is available.
 */

import { createHash } from "crypto";
import type { AgentProposal, ConsensusResult } from "@swarmmind/shared";
import { ConsensusResultSchema } from "@swarmmind/shared";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ConsensusConfig {
  /**
   * Decay factor used to penalize correlated (same-role, same-claim) agents.
   * Higher values increase the penalty. Default: 0.5
   */
  correlationDecay: number;
  /**
   * Minimum aggregate weighted score [0-1] required to declare consensus.
   * If no claim clears this bar the result has finalClaim = "" and
   * weightedScore = 0.  Default: 0.5
   */
  quorumThreshold: number;
  /**
   * Duration (ms) for which the challenge window stays open after consensus.
   * Set to 0 to disable the challenge mechanism.  Default: 86_400_000 (24 h)
   */
  challengeWindowMs: number;
}

const DEFAULT_CONFIG: ConsensusConfig = {
  correlationDecay: 0.5,
  quorumThreshold: 0.5,
  challengeWindowMs: 86_400_000,
};

// ─── Reputation Registry ──────────────────────────────────────────────────────

/**
 * Lightweight in-memory reputation store.
 * Production implementations should persist and load from a DB / on-chain
 * registry; this class provides the same interface.
 */
export class ReputationRegistry {
  private readonly scores: Map<string, number>;
  private readonly defaultWeight: number;

  constructor(defaultWeight = 1.0) {
    this.scores = new Map();
    this.defaultWeight = defaultWeight;
  }

  /** Update (or create) a domain-scoped reputation score using EWMA. */
  update(agentId: string, domain: string, outcomeScore: number, alpha = 0.3): void {
    const key = `${agentId}::${domain}`;
    const prev = this.scores.get(key) ?? this.defaultWeight;
    // Exponentially weighted moving average
    const next = prev * (1 - alpha) + outcomeScore * alpha;
    this.scores.set(key, Math.max(0, Math.min(2, next)));
  }

  /** Return [0-2] weight for agent in domain. Defaults to 1.0 (neutral). */
  getWeight(agentId: string, domain: string): number {
    return this.scores.get(`${agentId}::${domain}`) ?? this.defaultWeight;
  }

  /** Snapshot all scores (useful for debugging / persistence). */
  snapshot(): ReadonlyMap<string, number> {
    return new Map(this.scores);
  }
}

// ─── Consensus Engine ────────────────────────────────────────────────────────

export interface ContributionDetail {
  agentId: string;
  rawConfidence: number;
  weight: number;
  penalizedWeight: number;
  included: boolean;
}

export interface InternalConsensusOutput {
  finalClaim: string;
  weightedScore: number;
  supportCount: number;
  totalProposals: number;
  contributions: ContributionDetail[];
}

export class ConsensusEngine {
  private readonly config: ConsensusConfig;
  private readonly reputation: ReputationRegistry;

  constructor(reputation?: ReputationRegistry, config?: Partial<ConsensusConfig>) {
    this.reputation = reputation ?? new ReputationRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run a consensus round over a set of agent proposals.
   *
   * @param roundId   Stable identifier for this consensus round.
   * @param proposals Non-empty array of proposals from participating agents.
   * @param domain    Reputation domain used for weight lookup (e.g. "risk").
   */
  run(roundId: string, proposals: readonly AgentProposal[], domain = "general"): ConsensusResult {
    if (proposals.length === 0) {
      throw new Error("ConsensusEngine.run: proposals array must not be empty");
    }

    const output = this.computeConsensus(proposals, domain);
    const now = Date.now();
    const challengeExpiresAt =
      this.config.challengeWindowMs > 0 ? now + this.config.challengeWindowMs : 0;

    // Collect all evidence pointers from proposals that support the winning claim.
    const winningProposals = output.finalClaim
      ? proposals.filter((p) => p.claim === output.finalClaim)
      : proposals;
    const allEvidenceHashes = winningProposals.flatMap((p) => p.evidencePointers);
    const evidenceRoot = buildEvidenceRoot(allEvidenceHashes);

    const result: ConsensusResult = {
      roundId,
      finalClaim: output.finalClaim,
      weightedScore: output.weightedScore,
      supportCount: output.supportCount,
      totalProposals: output.totalProposals,
      contributions: output.contributions,
      challengeOpen: this.config.challengeWindowMs > 0,
      challengeExpiresAt,
      evidenceRoot,
      commitHash: buildCommitHash(roundId, output.finalClaim, output.weightedScore),
      timestamp: now,
    };

    return ConsensusResultSchema.parse(result);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private computeConsensus(
    proposals: readonly AgentProposal[],
    domain: string,
  ): InternalConsensusOutput {
    // Group by claim to apply correlation penalty within each claim group.
    const claimGroups = groupByClaim(proposals);
    const contributions: ContributionDetail[] = [];

    // Aggregate weighted+penalized score per claim.
    const claimScores = new Map<string, number>();

    for (const [claim, group] of claimGroups) {
      // Within a group, sort by role to cluster correlated (same-role) agents.
      const sorted = [...group].sort((a, b) => a.agentRole.localeCompare(b.agentRole));

      // Track how many agents of the same role have already contributed.
      const roleCount = new Map<string, number>();

      for (const proposal of sorted) {
        const roleKey = proposal.agentRole;
        const k = roleCount.get(roleKey) ?? 0;
        roleCount.set(roleKey, k + 1);

        const rawWeight = this.reputation.getWeight(proposal.agentId, domain);
        // Correlation penalty: 1 / (1 + decay × k)  (k starts at 0 for the first agent)
        const penaltyMultiplier = 1 / (1 + this.config.correlationDecay * k);
        const penalizedWeight = rawWeight * penaltyMultiplier;
        const contribution = penalizedWeight * proposal.confidence;

        contributions.push({
          agentId: proposal.agentId,
          rawConfidence: proposal.confidence,
          weight: rawWeight,
          penalizedWeight,
          included: true,
        });

        claimScores.set(claim, (claimScores.get(claim) ?? 0) + contribution);
      }
    }

    // Normalise scores so they are in [0, 1].
    const totalScore = [...claimScores.values()].reduce((s, v) => s + v, 0);
    if (totalScore === 0) {
      return noConsensus(proposals.length, contributions);
    }

    let bestClaim = "";
    let bestNormalized = 0;
    for (const [claim, score] of claimScores) {
      const normalized = score / totalScore;
      if (normalized > bestNormalized) {
        bestNormalized = normalized;
        bestClaim = claim;
      }
    }

    if (bestNormalized < this.config.quorumThreshold) {
      return noConsensus(proposals.length, contributions);
    }

    const supportCount = claimGroups.get(bestClaim)?.length ?? 0;
    return {
      finalClaim: bestClaim,
      weightedScore: round4(bestNormalized),
      supportCount,
      totalProposals: proposals.length,
      contributions,
    };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function groupByClaim(proposals: readonly AgentProposal[]): Map<string, AgentProposal[]> {
  const groups = new Map<string, AgentProposal[]>();
  for (const p of proposals) {
    const list = groups.get(p.claim) ?? [];
    list.push(p);
    groups.set(p.claim, list);
  }
  return groups;
}

function noConsensus(
  totalProposals: number,
  contributions: ContributionDetail[],
): InternalConsensusOutput {
  return {
    finalClaim: "",
    weightedScore: 0,
    supportCount: 0,
    totalProposals,
    contributions,
  };
}

function buildCommitHash(roundId: string, claim: string, score: number): string {
  const payload = `${roundId}::${claim}::${score.toFixed(8)}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Compute a Merkle root from an array of evidence pointer strings.
 *
 * Steps:
 *  1. Sort inputs lexicographically for determinism.
 *  2. Hash each as a leaf node.
 *  3. Pair and hash adjacent nodes up the tree; duplicate the last node on
 *     odd-length layers.
 *  4. Return the single root hash.
 *
 * An empty input set returns SHA-256("").
 */
function buildEvidenceRoot(evidencePointers: readonly string[]): string {
  if (evidencePointers.length === 0) {
    return createHash("sha256").update("").digest("hex");
  }

  let layer: string[] = [...evidencePointers]
    .sort()
    .map((p) => createHash("sha256").update(p).digest("hex"));

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(createHash("sha256").update(left + right).digest("hex"));
    }
    layer = next;
  }

  return layer[0]!;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
