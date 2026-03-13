import { describe, it, expect, vi, beforeEach } from "vitest";
import { VolatilityCalculator } from "../services/volatility-calculator";

describe("VolatilityCalculator", () => {
  let calc: VolatilityCalculator;

  beforeEach(() => {
    calc = new VolatilityCalculator();
  });

  describe("recordPrice", () => {
    it("stores price points for a token", () => {
      calc.recordPrice("OKB", 52.0, 1000);
      calc.recordPrice("OKB", 53.0, 2000);

      expect(calc.getTrackedTokens()).toEqual(["OKB"]);
    });

    it("normalizes token name to uppercase", () => {
      calc.recordPrice("okb", 52.0, 1000);

      expect(calc.getTrackedTokens()).toEqual(["OKB"]);
    });

    it("trims history to rolling window size", () => {
      for (let i = 0; i < 120; i++) {
        calc.recordPrice("OKB", 50 + i * 0.1, i * 1000);
      }

      const metrics = calc.getMetrics("OKB");
      expect(metrics.sampleCount).toBe(100);
    });
  });

  describe("getVolatility", () => {
    it("returns 0 for unknown token", () => {
      expect(calc.getVolatility("UNKNOWN")).toBe(0);
    });

    it("returns 0 for single data point", () => {
      calc.recordPrice("OKB", 52.0, 1000);
      expect(calc.getVolatility("OKB")).toBe(0);
    });

    it("returns standard deviation for multiple points", () => {
      calc.recordPrice("OKB", 50, 1000);
      calc.recordPrice("OKB", 52, 2000);
      calc.recordPrice("OKB", 48, 3000);
      calc.recordPrice("OKB", 51, 4000);

      const vol = calc.getVolatility("OKB");
      expect(vol).toBeGreaterThan(0);
      expect(vol).toBeLessThan(10);
    });

    it("returns 0 for identical prices", () => {
      calc.recordPrice("USDC", 1.0, 1000);
      calc.recordPrice("USDC", 1.0, 2000);

      expect(calc.getVolatility("USDC")).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("returns zero metrics for unknown token", () => {
      const metrics = calc.getMetrics("NOPE");

      expect(metrics.volatility).toBe(0);
      expect(metrics.trend).toBe("SIDEWAYS");
      expect(metrics.avgPrice).toBe(0);
      expect(metrics.high).toBe(0);
      expect(metrics.low).toBe(0);
      expect(metrics.sampleCount).toBe(0);
    });

    it("computes correct avg, high, low", () => {
      calc.recordPrice("ETH", 3000, 1000);
      calc.recordPrice("ETH", 3100, 2000);
      calc.recordPrice("ETH", 2900, 3000);
      calc.recordPrice("ETH", 3050, 4000);

      const metrics = calc.getMetrics("ETH");

      expect(metrics.avgPrice).toBeCloseTo(3012.5, 1);
      expect(metrics.high).toBe(3100);
      expect(metrics.low).toBe(2900);
      expect(metrics.sampleCount).toBe(4);
    });

    it("detects UP trend", () => {
      const prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];
      prices.forEach((p, i) => calc.recordPrice("UP", p, i * 1000));

      expect(calc.getMetrics("UP").trend).toBe("UP");
    });

    it("detects DOWN trend", () => {
      const prices = [120, 118, 116, 114, 112, 110, 108, 106, 104, 102];
      prices.forEach((p, i) => calc.recordPrice("DOWN", p, i * 1000));

      expect(calc.getMetrics("DOWN").trend).toBe("DOWN");
    });

    it("detects SIDEWAYS trend", () => {
      const prices = [100, 100.5, 99.5, 100.2, 99.8, 100.1, 99.9, 100, 100.3, 99.7];
      prices.forEach((p, i) => calc.recordPrice("FLAT", p, i * 1000));

      expect(calc.getMetrics("FLAT").trend).toBe("SIDEWAYS");
    });
  });
});
