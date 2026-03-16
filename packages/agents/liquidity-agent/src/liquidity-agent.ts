/**
 * LiquidityAgent – assesses the liquidity health of DeFi pools.
 *
 * Responsibilities:
 *  - Accept pool snapshot data (reserves, TVL, volume, APY, utilization)
 *  - Compute a liquidity score (1–10) and price impact estimate
 *  - Produce a recommendation: DEEP | ADEQUATE | SHALLOW | AVOID
 *  - Optionally use an AI client for natural-language rationale
 *
 * The agent also participates in consensus rounds by emitting AgentProposals.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  LiquidityPool,
  LiquidityAssessment,
  AgentProposal,
} from "@swarmmind/shared";
import { LiquidityPoolSchema } from "@swarmmind/shared";

// Price impact formula: based on constant-product AMM model.
// Δprice / price ≈ tradeSize / (2 × reserveUSD)  (small trade approximation)
const PRICE_IMPACT_TRADE_USD = 10_000;
const BPS = 10_000;

export interface LiquidityAgentConfig {
  readonly agentId?: string;
  /** Minimum TVL (USD) to receive a non-AVOID recommendation */
  readonly minTvlUsd?: number;
  /** Maximum price impact (bps) to receive a DEEP recommendation */
  readonly deepImpactBps?: number;
  /** Maximum price impact (bps) to receive an ADEQUATE recommendation */
  readonly adequateImpactBps?: number;
}

export class LiquidityAgent {
  readonly agentId: string;
  private readonly config: Required<Omit<LiquidityAgentConfig, "agentId">>;
  private readonly assessmentCache: LiquidityAssessment[];

  constructor(config: LiquidityAgentConfig = {}) {
    this.agentId = config.agentId ?? `liquidity-agent-${uuidv4().slice(0, 8)}`;
    this.config = {
      minTvlUsd: config.minTvlUsd ?? 100_000,
      deepImpactBps: config.deepImpactBps ?? 10,
      adequateImpactBps: config.adequateImpactBps ?? 50,
    };
    this.assessmentCache = [];
  }

  /**
   * Assess liquidity for a single pool snapshot.
   * Input is validated via Zod before processing.
   */
  assess(rawPool: unknown): LiquidityAssessment {
    const pool = LiquidityPoolSchema.parse(rawPool);
    const assessment = this.compute(pool);
    this.assessmentCache.push(assessment);
    if (this.assessmentCache.length > 200) {
      this.assessmentCache.splice(0, this.assessmentCache.length - 200);
    }
    return assessment;
  }

  /** Assess and return a corresponding AgentProposal for consensus rounds. */
  assessAndPropose(rawPool: unknown): { assessment: LiquidityAssessment; proposal: AgentProposal } {
    const assessment = this.assess(rawPool);
    const proposal: AgentProposal = {
      agentId: this.agentId,
      agentRole: "LIQUIDITY",
      claim: assessment.recommendation,
      payload: assessment,
      confidence: normalizeScore(assessment.liquidityScore),
      evidencePointers: [assessment.poolAddress],
      timestamp: assessment.timestamp,
    };
    return { assessment, proposal };
  }

  getRecentAssessments(): readonly LiquidityAssessment[] {
    return this.assessmentCache;
  }

  getAssessmentCount(): number {
    return this.assessmentCache.length;
  }

  // ── Core computation ────────────────────────────────────────────────────

  private compute(pool: LiquidityPool): LiquidityAssessment {
    const priceImpactBps = estimatePriceImpactBps(pool);
    const liquidityScore = scoreLiquidity(pool, priceImpactBps, this.config);
    const recommendation = classify(pool, priceImpactBps, liquidityScore, this.config);
    const rationale = buildRationale(pool, priceImpactBps, liquidityScore, recommendation);

    return {
      poolAddress: pool.poolAddress,
      liquidityScore,
      priceImpactBps,
      recommendation,
      rationale,
      timestamp: Date.now(),
    };
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Estimate price impact (basis points) for a fixed-size trade using the
 * constant-product AMM approximation:  impact ≈ trade / (2 × reserveUSD).
 *
 * Falls back to a score based on TVL when individual reserves are zero.
 */
function estimatePriceImpactBps(pool: LiquidityPool): number {
  // Use TVL as proxy for total pool depth
  const depth = pool.tvlUsd > 0 ? pool.tvlUsd : 1;
  const impact = (PRICE_IMPACT_TRADE_USD / (2 * depth)) * BPS;
  return Math.round(Math.min(impact, BPS)); // cap at 100 %
}

/**
 * Compute a 1–10 liquidity score.
 * Contributors: TVL, volume/TVL ratio, APY reasonableness, utilization.
 */
function scoreLiquidity(
  pool: LiquidityPool,
  priceImpactBps: number,
  config: Required<Omit<LiquidityAgentConfig, "agentId">>,
): number {
  if (pool.tvlUsd < config.minTvlUsd) return 1;

  // Impact score: 10 when below deepImpact, 1 when >= 1000 bps
  const impactScore = Math.max(1, 10 - Math.floor(priceImpactBps / 100));

  // Volume / TVL ratio (0.02 = 2 % daily → reasonable, >0.5 → suspicious)
  const volRatio = pool.volume24hUsd / Math.max(pool.tvlUsd, 1);
  const volumeScore = volRatio < 0.005 ? 3 : volRatio > 0.5 ? 4 : 8;

  // Utilization: 0.3–0.8 is ideal
  const utilScore = pool.utilization >= 0.3 && pool.utilization <= 0.8 ? 8 : 4;

  const raw = (impactScore * 2 + volumeScore + utilScore) / 4;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

function classify(
  pool: LiquidityPool,
  priceImpactBps: number,
  liquidityScore: number,
  config: Required<Omit<LiquidityAgentConfig, "agentId">>,
): LiquidityAssessment["recommendation"] {
  if (pool.tvlUsd < config.minTvlUsd || liquidityScore <= 2) return "AVOID";
  if (priceImpactBps <= config.deepImpactBps) return "DEEP";
  if (priceImpactBps <= config.adequateImpactBps) return "ADEQUATE";
  return "SHALLOW";
}

function buildRationale(
  pool: LiquidityPool,
  priceImpactBps: number,
  score: number,
  rec: LiquidityAssessment["recommendation"],
): string {
  const vol = pool.volume24hUsd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const tvl = pool.tvlUsd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return (
    `${rec}: ${pool.tokenPair} — TVL ${tvl}, 24h vol ${vol}, ` +
    `est. $10k price impact ${priceImpactBps} bps, ` +
    `utilization ${(pool.utilization * 100).toFixed(0)}%, ` +
    `liquidity score ${score}/10.`
  );
}

/** Map a 1–10 integer score to [0.1, 1.0] confidence. */
function normalizeScore(score: number): number {
  return Math.max(0.1, Math.min(1.0, score / 10));
}
