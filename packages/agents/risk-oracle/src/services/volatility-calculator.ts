const ROLLING_WINDOW_SIZE = 100;

interface PricePoint {
  readonly price: number;
  readonly timestamp: number;
}

export interface VolatilityMetrics {
  readonly volatility: number;
  readonly trend: "UP" | "DOWN" | "SIDEWAYS";
  readonly avgPrice: number;
  readonly high: number;
  readonly low: number;
  readonly sampleCount: number;
}

export class VolatilityCalculator {
  private readonly priceHistory: Map<string, readonly PricePoint[]>;

  constructor() {
    this.priceHistory = new Map();
  }

  recordPrice(token: string, price: number, timestamp: number): void {
    const key = token.toUpperCase();
    const existing = this.priceHistory.get(key) ?? [];
    const newPoint: PricePoint = { price, timestamp };

    const updated = [...existing, newPoint];
    const trimmed =
      updated.length > ROLLING_WINDOW_SIZE
        ? updated.slice(updated.length - ROLLING_WINDOW_SIZE)
        : updated;

    this.priceHistory.set(key, trimmed);
  }

  getVolatility(token: string): number {
    const key = token.toUpperCase();
    const points = this.priceHistory.get(key);

    if (!points || points.length < 2) {
      return 0;
    }

    return computeStdDev(points.map((p) => p.price));
  }

  getMetrics(token: string): VolatilityMetrics {
    const key = token.toUpperCase();
    const points = this.priceHistory.get(key);

    if (!points || points.length === 0) {
      return {
        volatility: 0,
        trend: "SIDEWAYS",
        avgPrice: 0,
        high: 0,
        low: 0,
        sampleCount: 0,
      };
    }

    const prices = points.map((p) => p.price);
    const volatility = points.length >= 2 ? computeStdDev(prices) : 0;
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const trend = determineTrend(prices);

    return { volatility, trend, avgPrice, high, low, sampleCount: points.length };
  }

  getTrackedTokens(): readonly string[] {
    return [...this.priceHistory.keys()];
  }
}

function computeStdDev(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function determineTrend(prices: readonly number[]): "UP" | "DOWN" | "SIDEWAYS" {
  if (prices.length < 3) {
    return "SIDEWAYS";
  }

  const recentCount = Math.min(10, Math.floor(prices.length / 2));
  const recentSlice = prices.slice(-recentCount);
  const earlierSlice = prices.slice(0, recentCount);

  const recentAvg = recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length;
  const earlierAvg = earlierSlice.reduce((s, v) => s + v, 0) / earlierSlice.length;

  const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  const TREND_THRESHOLD = 2;

  if (changePercent > TREND_THRESHOLD) {
    return "UP";
  }
  if (changePercent < -TREND_THRESHOLD) {
    return "DOWN";
  }
  return "SIDEWAYS";
}
