import { v4 as uuidv4 } from "uuid";
import {
  AIClient,
  PROMPT_TEMPLATES,
  TokenPrice,
  TradingSignal,
  SignalType,
} from "@swarmmind/shared";

const MAX_STORED_SIGNALS = 100;
const SOURCE_NAME = "alpha-scout";

interface RawSignal {
  readonly type: SignalType;
  readonly tokenPair: string;
  readonly direction: "BUY" | "SELL";
  readonly confidence: number;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly rationale: string;
}

interface AnalysisResponse {
  readonly signals: readonly RawSignal[];
}

export class SignalGenerator {
  private readonly ai: AIClient;
  private signals: readonly TradingSignal[] = [];

  constructor(ai: AIClient) {
    this.ai = ai;
  }

  async analyzeMarket(prices: readonly TokenPrice[]): Promise<readonly TradingSignal[]> {
    if (prices.length === 0) {
      return [];
    }

    const marketData = formatMarketData(prices);
    const prompt = PROMPT_TEMPLATES.alphaScout.analyzeMarket(marketData);

    try {
      const result = await this.ai.structuredChat<AnalysisResponse>(
        PROMPT_TEMPLATES.alphaScout.system,
        prompt,
      );

      const newSignals = toTradingSignals(result.signals);
      this.signals = appendSignals(this.signals, newSignals, MAX_STORED_SIGNALS);

      console.log("[SignalGenerator] Generated %d signals", newSignals.length);
      return newSignals;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[SignalGenerator] Analysis failed: %s", message);
      return [];
    }
  }

  getLatestSignals(count: number): readonly TradingSignal[] {
    return this.signals.slice(-count);
  }

  getSignalsByType(type: SignalType): readonly TradingSignal[] {
    return this.signals.filter((s) => s.type === type);
  }

  getSignalCount(): number {
    return this.signals.length;
  }
}

function formatMarketData(prices: readonly TokenPrice[]): string {
  const lines = prices.map(
    (p) =>
      `${p.tokenSymbol}: price=${p.price}, volume24h=${p.volume24h}, change24h=${p.change24h}`,
  );
  return lines.join("\n");
}

function toTradingSignals(raw: readonly RawSignal[]): readonly TradingSignal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const now = Date.now();

  return raw
    .filter(isValidRawSignal)
    .map((s) => ({
      id: uuidv4(),
      type: s.type,
      tokenPair: s.tokenPair,
      direction: s.direction,
      confidence: clamp(s.confidence, 0, 1),
      entryPrice: s.entryPrice,
      targetPrice: s.targetPrice,
      stopLoss: s.stopLoss,
      rationale: s.rationale,
      timestamp: now,
      source: SOURCE_NAME,
    }));
}

function isValidRawSignal(s: unknown): s is RawSignal {
  if (typeof s !== "object" || s === null) {
    return false;
  }

  const obj = s as Record<string, unknown>;
  const validTypes: readonly string[] = ["ARBITRAGE", "MOMENTUM", "MEAN_REVERSION"];
  const validDirections: readonly string[] = ["BUY", "SELL"];

  return (
    typeof obj.type === "string" &&
    validTypes.includes(obj.type) &&
    typeof obj.tokenPair === "string" &&
    typeof obj.direction === "string" &&
    validDirections.includes(obj.direction) &&
    typeof obj.confidence === "number" &&
    typeof obj.entryPrice === "number" &&
    typeof obj.targetPrice === "number" &&
    typeof obj.stopLoss === "number" &&
    typeof obj.rationale === "string"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function appendSignals(
  existing: readonly TradingSignal[],
  added: readonly TradingSignal[],
  limit: number,
): readonly TradingSignal[] {
  const combined = [...existing, ...added];
  if (combined.length <= limit) {
    return combined;
  }
  return combined.slice(combined.length - limit);
}
