import { v4 as uuidv4 } from "uuid";
import { TokenPrice, TradingSignal } from "@swarmmind/shared";

const PRICE_CHANGE_THRESHOLD_PERCENT = 3;
const SOURCE_NAME = "alpha-scout:arbitrage";

interface PriceSnapshot {
  readonly price: number;
  readonly timestamp: number;
}

export class ArbitrageDetector {
  private readonly priceHistory: Map<string, readonly PriceSnapshot[]> = new Map();
  private readonly maxHistoryPerToken = 60;

  detect(prices: readonly TokenPrice[]): readonly TradingSignal[] {
    const now = Date.now();
    const updatedHistory = this.recordPrices(prices, now);
    this.priceHistory.clear();
    for (const [key, value] of updatedHistory.entries()) {
      this.priceHistory.set(key, value);
    }

    const signals: TradingSignal[] = [];

    for (const token of prices) {
      const symbol = token.tokenSymbol;
      const history = this.priceHistory.get(symbol);

      if (!history || history.length < 2) {
        continue;
      }

      const signal = detectPriceMovement(symbol, history, now);
      if (signal !== null) {
        signals.push(signal);
      }
    }

    const crossSignals = detectCrossTokenDiscrepancies(prices, now);
    return [...signals, ...crossSignals];
  }

  private recordPrices(
    prices: readonly TokenPrice[],
    now: number,
  ): Map<string, readonly PriceSnapshot[]> {
    const result = new Map<string, readonly PriceSnapshot[]>();

    for (const [key, existing] of this.priceHistory.entries()) {
      result.set(key, existing);
    }

    for (const token of prices) {
      const currentPrice = parseFloat(token.price);
      if (isNaN(currentPrice) || currentPrice <= 0) {
        continue;
      }

      const snapshot: PriceSnapshot = { price: currentPrice, timestamp: now };
      const existing = result.get(token.tokenSymbol) ?? [];
      const updated = [...existing, snapshot];

      result.set(
        token.tokenSymbol,
        updated.length > this.maxHistoryPerToken
          ? updated.slice(updated.length - this.maxHistoryPerToken)
          : updated,
      );
    }

    return result;
  }
}

function detectPriceMovement(
  symbol: string,
  history: readonly PriceSnapshot[],
  now: number,
): TradingSignal | null {
  const latest = history[history.length - 1];
  const oldest = history[0];

  if (latest.price <= 0 || oldest.price <= 0) {
    return null;
  }

  const changePercent = ((latest.price - oldest.price) / oldest.price) * 100;
  const absChange = Math.abs(changePercent);

  if (absChange < PRICE_CHANGE_THRESHOLD_PERCENT) {
    return null;
  }

  const isBullish = changePercent > 0;
  const confidence = Math.min(absChange / 10, 0.9);

  return {
    id: uuidv4(),
    type: "MOMENTUM",
    tokenPair: `${symbol}/USDC`,
    direction: isBullish ? "BUY" : "SELL",
    confidence,
    entryPrice: latest.price,
    targetPrice: isBullish
      ? latest.price * 1.02
      : latest.price * 0.98,
    stopLoss: isBullish
      ? latest.price * 0.98
      : latest.price * 1.02,
    rationale: `${symbol} moved ${changePercent.toFixed(2)}% over observation window, indicating strong ${isBullish ? "bullish" : "bearish"} momentum.`,
    timestamp: now,
    source: SOURCE_NAME,
  };
}

function detectCrossTokenDiscrepancies(
  prices: readonly TokenPrice[],
  now: number,
): readonly TradingSignal[] {
  const signals: TradingSignal[] = [];

  const stablecoins = prices.filter(
    (p) => p.tokenSymbol === "USDT" || p.tokenSymbol === "USDC",
  );

  if (stablecoins.length < 2) {
    return signals;
  }

  const usdtPrice = stablecoins.find((p) => p.tokenSymbol === "USDT");
  const usdcPrice = stablecoins.find((p) => p.tokenSymbol === "USDC");

  if (!usdtPrice || !usdcPrice) {
    return signals;
  }

  const usdt = parseFloat(usdtPrice.price);
  const usdc = parseFloat(usdcPrice.price);

  if (usdt <= 0 || usdc <= 0) {
    return signals;
  }

  const spread = Math.abs(usdt - usdc);
  const spreadPercent = (spread / Math.min(usdt, usdc)) * 100;

  if (spreadPercent < 0.5) {
    return signals;
  }

  const buyToken = usdt < usdc ? "USDT" : "USDC";
  const sellToken = usdt < usdc ? "USDC" : "USDT";
  const buyPrice = Math.min(usdt, usdc);

  signals.push({
    id: uuidv4(),
    type: "ARBITRAGE",
    tokenPair: `${buyToken}/${sellToken}`,
    direction: "BUY",
    confidence: Math.min(spreadPercent / 5, 0.85),
    entryPrice: buyPrice,
    targetPrice: Math.max(usdt, usdc),
    stopLoss: buyPrice * 0.995,
    rationale: `Stablecoin spread of ${spreadPercent.toFixed(3)}% detected between USDT and USDC on X Layer.`,
    timestamp: now,
    source: SOURCE_NAME,
  });

  return signals;
}
