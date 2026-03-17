import {
  AIClient,
  PROMPT_TEMPLATES,
  type TradingSignal,
  type RiskAssessment,
  type RiskRecommendation,
} from "@swarmmind/shared";
import type { VolatilityCalculator, VolatilityMetrics } from "./volatility-calculator";

const MAX_CACHED_ASSESSMENTS = 50;

interface ClaudeRiskResponse {
  readonly riskScore: number;
  readonly maxDrawdown: number;
  readonly recommendation: string;
  readonly rationale: string;
}

export class RiskEvaluator {
  private readonly ai: AIClient;
  private readonly volatilityCalc: VolatilityCalculator;
  private assessmentCache: readonly RiskAssessment[];

  constructor(ai: AIClient, volatilityCalc: VolatilityCalculator) {
    this.ai = ai;
    this.volatilityCalc = volatilityCalc;
    this.assessmentCache = [];
  }

  async assessTrade(signal: TradingSignal): Promise<RiskAssessment> {
    const token = extractToken(signal.tokenPair);
    const metrics = this.volatilityCalc.getMetrics(token);
    const prompt = buildAssessmentPrompt(signal, metrics);

    const claudeResponse = await this.ai.structuredChat<ClaudeRiskResponse>(
      PROMPT_TEMPLATES.riskOracle.system,
      PROMPT_TEMPLATES.riskOracle.assessTrade(prompt),
    );

    const assessment: RiskAssessment = {
      signalId: signal.id,
      riskScore: clampRiskScore(claudeResponse.riskScore),
      maxDrawdown: Math.max(0, claudeResponse.maxDrawdown),
      recommendation: normalizeRecommendation(claudeResponse.recommendation),
      rationale: claudeResponse.rationale || "No rationale provided",
      timestamp: Date.now(),
    };

    this.addToCache(assessment);
    return assessment;
  }

  getRecentAssessments(): readonly RiskAssessment[] {
    return this.assessmentCache;
  }

  getAssessmentById(signalId: string): RiskAssessment | undefined {
    return this.assessmentCache.find((a) => a.signalId === signalId);
  }

  getAssessmentCount(): number {
    return this.assessmentCache.length;
  }

  private addToCache(assessment: RiskAssessment): void {
    const updated = [...this.assessmentCache, assessment];
    this.assessmentCache =
      updated.length > MAX_CACHED_ASSESSMENTS
        ? updated.slice(updated.length - MAX_CACHED_ASSESSMENTS)
        : updated;
  }
}

function extractToken(tokenPair: string): string {
  const parts = tokenPair.split("/");
  return parts[0] || tokenPair;
}

function clampRiskScore(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score)));
}

function normalizeRecommendation(rec: string): RiskRecommendation {
  const upper = rec.toUpperCase().trim();
  if (upper === "PROCEED" || upper === "CAUTION" || upper === "REJECT") {
    return upper;
  }
  return "CAUTION";
}

function buildAssessmentPrompt(
  signal: TradingSignal,
  metrics: VolatilityMetrics,
): string {
  const signalInfo = [
    `Signal ID: ${signal.id}`,
    `Type: ${signal.type}`,
    `Token Pair: ${signal.tokenPair}`,
    `Direction: ${signal.direction}`,
    `Confidence: ${signal.confidence}`,
    `Entry Price: ${signal.entryPrice}`,
    `Target Price: ${signal.targetPrice}`,
    `Stop Loss: ${signal.stopLoss}`,
    `Rationale: ${signal.rationale}`,
    `Source: ${signal.source}`,
  ].join("\n");

  const volatilityInfo =
    metrics.sampleCount > 0
      ? [
          `\nVolatility Data:`,
          `  Standard Deviation: ${metrics.volatility.toFixed(6)}`,
          `  Trend: ${metrics.trend}`,
          `  Average Price: ${metrics.avgPrice.toFixed(6)}`,
          `  High: ${metrics.high.toFixed(6)}`,
          `  Low: ${metrics.low.toFixed(6)}`,
          `  Sample Count: ${metrics.sampleCount}`,
        ].join("\n")
      : "\nVolatility Data: No historical data available";

  return `${signalInfo}${volatilityInfo}`;
}
