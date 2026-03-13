import { AIClient, PROMPT_TEMPLATES, type UserStrategy } from "@swarmmind/shared";

const DEFAULT_STRATEGY: UserStrategy = {
  riskTolerance: "MEDIUM",
  maxPositionSize: 100,
  preferredTokens: ["OKB", "USDC"],
  strategyType: "BALANCED",
  constraints: [],
};

export class IntentParser {
  private readonly ai: AIClient;

  constructor(ai: AIClient) {
    this.ai = ai;
  }

  async parseStrategy(text: string): Promise<UserStrategy> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return DEFAULT_STRATEGY;
    }

    const systemPrompt = PROMPT_TEMPLATES.portfolioManager.system;
    const userMessage = PROMPT_TEMPLATES.portfolioManager.parseIntent(trimmed);

    const parsed = await this.ai.structuredChat<RawParsedStrategy>(
      systemPrompt,
      userMessage,
    );

    return validateStrategy(parsed);
  }
}

interface RawParsedStrategy {
  readonly riskTolerance?: string;
  readonly maxPositionSize?: number;
  readonly preferredTokens?: readonly string[];
  readonly strategyType?: string;
  readonly constraints?: readonly string[];
}

function isValidRiskTolerance(value: string): value is UserStrategy["riskTolerance"] {
  return ["LOW", "MEDIUM", "HIGH"].includes(value);
}

function isValidStrategyType(value: string): value is UserStrategy["strategyType"] {
  return ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"].includes(value);
}

function validateStrategy(raw: RawParsedStrategy): UserStrategy {
  const riskTolerance =
    raw.riskTolerance && isValidRiskTolerance(raw.riskTolerance)
      ? raw.riskTolerance
      : DEFAULT_STRATEGY.riskTolerance;

  const strategyType =
    raw.strategyType && isValidStrategyType(raw.strategyType)
      ? raw.strategyType
      : DEFAULT_STRATEGY.strategyType;

  const maxPositionSize =
    typeof raw.maxPositionSize === "number" && raw.maxPositionSize > 0
      ? raw.maxPositionSize
      : DEFAULT_STRATEGY.maxPositionSize;

  const preferredTokens =
    Array.isArray(raw.preferredTokens) && raw.preferredTokens.length > 0
      ? raw.preferredTokens.map(String)
      : [...DEFAULT_STRATEGY.preferredTokens];

  const constraints =
    Array.isArray(raw.constraints)
      ? raw.constraints.map(String)
      : [...DEFAULT_STRATEGY.constraints];

  return {
    riskTolerance,
    maxPositionSize,
    preferredTokens,
    strategyType,
    constraints,
  };
}
