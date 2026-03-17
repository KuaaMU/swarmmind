"use client";

import type { LiquidityPoolDash } from "../lib/types";

interface LiquidityPanelProps {
  pools: LiquidityPoolDash[];
}

const REC_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  DEEP: { label: "DEEP", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  ADEQUATE: { label: "OK", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  SHALLOW: { label: "SHALLOW", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  AVOID: { label: "AVOID", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

function fmt(value: number, prefix = "$"): string {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  return `${prefix}${value.toFixed(2)}`;
}

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 8 ? "#22c55e" : score >= 5 ? "#3b82f6" : score >= 3 ? "#eab308" : "#ef4444";
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
      style={{ border: `2px solid ${color}`, color }}
    >
      {score}
    </div>
  );
}

function UtilBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const ideal = value >= 0.3 && value <= 0.8;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${ideal ? "bg-blue-500" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function LiquidityPanel({ pools }: LiquidityPanelProps) {
  if (pools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm">
        No pool data available
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
      {pools.map((pool) => {
        const rec = REC_STYLES[pool.recommendation] ?? REC_STYLES.AVOID;
        return (
          <div
            key={pool.poolAddress}
            className="bg-gray-800/40 rounded-lg border border-gray-700/40 p-3 hover:border-gray-600/60 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <ScoreCircle score={pool.liquidityScore} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-200 truncate">
                    {pool.tokenPair}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border ${rec.color} ${rec.bg} shrink-0`}
                  >
                    {rec.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                  <span>TVL {fmt(pool.tvlUsd)}</span>
                  <span>24h vol {fmt(pool.volume24hUsd)}</span>
                  <span>APY {pool.apy.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Utilization bar */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600">Utilization</span>
                <span className="text-[10px] text-gray-600">
                  Impact ~{pool.priceImpactBps} bps ($10k)
                </span>
              </div>
              <UtilBar value={pool.utilization} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
