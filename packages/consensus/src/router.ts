/**
 * SwarmMind v1 – Domain Router
 *
 * Routes incoming AgentProposals to domain-specific consensus pools and runs
 * a separate consensus round per active domain.  This ensures that:
 *
 *  - Agents specialised in "liquidation_risk" only compete with other agents
 *    in that domain, preventing cross-domain signal pollution.
 *  - Domain-specific ReputationRegistry scores are used for each round.
 *  - A single call to `routeAndRun()` returns one ConsensusResult per domain
 *    that had at least one proposal.
 *
 * Supported domains mirror the `Domain` union from `@swarmmind/shared-types`:
 *   liquidation_risk | pool_anomaly | cross_venue_spread |
 *   contract_health  | news_sentiment
 *
 * For proposals that carry a `domain` field (packages/shared-types protocol),
 * the router uses that field directly.  For legacy proposals that omit it, the
 * router falls back to a keyword-based claim classifier.
 */

import { ConsensusEngine, ReputationRegistry } from "./engine";
import type { AgentProposal, ConsensusResult } from "@swarmmind/shared";

// ─── Domain constants ─────────────────────────────────────────────────────────

export const SUPPORTED_DOMAINS = [
  "liquidation_risk",
  "pool_anomaly",
  "cross_venue_spread",
  "contract_health",
  "news_sentiment",
] as const;

export type RoutableDomain = (typeof SUPPORTED_DOMAINS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DomainRouterConfig {
  /**
   * Per-domain ConsensusEngine configuration overrides.
   * Keys are domain strings; the value is merged with the default ConsensusConfig.
   */
  domainConfig?: Partial<Record<RoutableDomain, Partial<DomainEngineConfig>>>;
  /** Shared default config applied to all domains unless overridden. */
  defaultConfig?: DomainEngineConfig;
}

export interface DomainEngineConfig {
  correlationDecay: number;
  quorumThreshold: number;
  challengeWindowMs: number;
}

export interface DomainRouterResult {
  /** Successful consensus results, keyed by domain. */
  results: Map<RoutableDomain, ConsensusResult>;
  /** Domains that received proposals but failed to reach quorum. */
  noConsensus: RoutableDomain[];
  /** Domains that received no proposals at all. */
  skipped: RoutableDomain[];
}

// ─── DomainRouter ─────────────────────────────────────────────────────────────

/**
 * Routes proposals by domain and runs one consensus round per domain.
 */
export class DomainRouter {
  private readonly engines: Map<RoutableDomain, ConsensusEngine>;
  private readonly reputations: Map<RoutableDomain, ReputationRegistry>;

  constructor(config: DomainRouterConfig = {}) {
    const defaults: DomainEngineConfig = {
      correlationDecay: 0.5,
      quorumThreshold: 0.5,
      challengeWindowMs: 86_400_000,
      ...config.defaultConfig,
    };

    this.engines = new Map();
    this.reputations = new Map();

    for (const domain of SUPPORTED_DOMAINS) {
      const override = config.domainConfig?.[domain] ?? {};
      const merged: DomainEngineConfig = { ...defaults, ...override };
      const rep = new ReputationRegistry();
      this.reputations.set(domain, rep);
      this.engines.set(domain, new ConsensusEngine(rep, merged));
    }
  }

  /**
   * Route proposals to their respective domains and run consensus.
   *
   * @param roundIdPrefix  Prefix for the consensus round IDs; the domain name
   *                       is appended automatically (e.g. "round-1::liquidation_risk").
   * @param proposals       All proposals from all agents for this cycle.
   */
  routeAndRun(
    roundIdPrefix: string,
    proposals: readonly AgentProposal[],
  ): DomainRouterResult {
    // Group proposals by resolved domain.
    const grouped = new Map<RoutableDomain, AgentProposal[]>();
    for (const domain of SUPPORTED_DOMAINS) {
      grouped.set(domain, []);
    }

    for (const proposal of proposals) {
      const domain = resolveDomain(proposal);
      if (domain) {
        grouped.get(domain)!.push(proposal);
      }
      // Proposals whose domain cannot be resolved are silently dropped.
    }

    const results = new Map<RoutableDomain, ConsensusResult>();
    const noConsensus: RoutableDomain[] = [];
    const skipped: RoutableDomain[] = [];

    for (const [domain, domainProposals] of grouped) {
      if (domainProposals.length === 0) {
        skipped.push(domain);
        continue;
      }

      const engine = this.engines.get(domain)!;
      const roundId = `${roundIdPrefix}::${domain}`;
      const result = engine.run(roundId, domainProposals, domain);

      if (result.finalClaim === "" || result.weightedScore === 0) {
        noConsensus.push(domain);
      } else {
        results.set(domain, result);
      }
    }

    return { results, noConsensus, skipped };
  }

  /**
   * Update the reputation of an agent for a specific domain after an outcome.
   * Call this after results are verified (e.g., after challenge window closes).
   *
   * @param agentId    The agent whose reputation to update.
   * @param domain     The domain in which the outcome was observed.
   * @param outcome    A 0–1 outcome score (1 = fully correct, 0 = wrong/malicious).
   * @param alpha      EWMA learning rate (default: 0.3).
   */
  updateReputation(
    agentId: string,
    domain: RoutableDomain,
    outcome: number,
    alpha = 0.3,
  ): void {
    const rep = this.reputations.get(domain);
    if (rep) {
      rep.update(agentId, domain, outcome, alpha);
    }
  }

  /**
   * Read the current reputation score of an agent for a domain.
   */
  getReputation(agentId: string, domain: RoutableDomain): number {
    return this.reputations.get(domain)?.getWeight(agentId, domain) ?? 1.0;
  }

  /**
   * Snapshot all reputation scores (useful for persistence / debugging).
   */
  snapshotReputations(): Record<RoutableDomain, ReadonlyMap<string, number>> {
    const snap = {} as Record<RoutableDomain, ReadonlyMap<string, number>>;
    for (const [domain, rep] of this.reputations) {
      snap[domain] = rep.snapshot();
    }
    return snap;
  }
}

// ─── Domain resolution helpers ────────────────────────────────────────────────

/**
 * Resolve the domain of a proposal.
 *
 * Priority:
 *  1. The proposal carries an explicit `domain` field (protocol v1 proposals from
 *     @swarmmind/shared-types).  We accept it if it matches a supported domain.
 *  2. Keyword-based classifier on `proposal.claim` for legacy/plain proposals.
 */
function resolveDomain(proposal: AgentProposal): RoutableDomain | null {
  // Protocol v1: explicit domain field (cast since legacy type may not have it)
  const explicitDomain = (proposal as { domain?: string }).domain;
  if (explicitDomain && SUPPORTED_DOMAINS.includes(explicitDomain as RoutableDomain)) {
    return explicitDomain as RoutableDomain;
  }

  // Fallback: keyword classifier on the claim text
  return classifyClaimDomain(proposal.claim);
}

/**
 * Lightweight keyword-based domain classifier for legacy proposals that do not
 * carry an explicit `domain` field.
 *
 * Precedence (first match wins):
 *  1. liquidation_risk  – liquidation / collateral / margin keywords
 *  2. pool_anomaly      – AMM pool / impermanent-loss / TVL keywords
 *  3. cross_venue_spread – arbitrage / spread / cross-venue keywords
 *  4. contract_health   – smart-contract vulnerability keywords
 *  5. news_sentiment    – sentiment / social media keywords
 *
 * Claims that match multiple patterns are assigned to the first matching domain
 * in the order above.  Prefer explicit `domain` fields (protocol v1) to avoid
 * ambiguity.
 *
 * Returns the best-matching domain or null if no domain can be inferred.
 */
function classifyClaimDomain(claim: string): RoutableDomain | null {
  const lower = claim.toLowerCase();

  if (/liquidat|collateral|health factor|margin call|at risk/.test(lower)) {
    return "liquidation_risk";
  }
  if (/pool anomaly|impermanent loss|reserve imbalance|abnormal tvl|flash loan/.test(lower)) {
    return "pool_anomaly";
  }
  if (/spread|arbitrage|cross.venue|price discrepan|venue/.test(lower)) {
    return "cross_venue_spread";
  }
  if (/contract|vulnerability|exploit|reentrancy|admin key|upgrade/.test(lower)) {
    return "contract_health";
  }
  if (/sentiment|news|social|twitter|reddit|fear|greed/.test(lower)) {
    return "news_sentiment";
  }

  return null;
}
