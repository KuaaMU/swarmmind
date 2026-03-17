"use client";

import type { ConsensusRound } from "../lib/types";

interface ConsensusPanelProps {
  rounds: ConsensusRound[];
}

const CLAIM_COLORS: Record<string, string> = {
  APPROVE_TRADE: "text-green-400",
  REJECT_TRADE: "text-red-400",
  REDUCE_SIZE: "text-yellow-400",
};

function claimColor(claim: string): string {
  for (const [prefix, color] of Object.entries(CLAIM_COLORS)) {
    if (claim.startsWith(prefix)) return color;
  }
  return "text-gray-300";
}

function scoreBar(score: number): React.ReactNode {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function ConsensusPanel({ rounds }: ConsensusPanelProps) {
  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm">
        No consensus rounds yet
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
      {rounds.map((r) => (
        <div
          key={r.roundId}
          className="bg-gray-800/40 rounded-lg border border-gray-700/40 p-3 hover:border-gray-600/60 transition-colors"
        >
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-mono text-gray-500 truncate">{r.roundId}</span>
            <div className="flex items-center gap-2 shrink-0">
              {r.challengeOpen && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
                  CHALLENGED
                </span>
              )}
              <span className="text-[10px] text-gray-600">{timeAgo(r.timestamp)}</span>
            </div>
          </div>

          {/* Claim */}
          <p className={`text-xs font-medium mb-2 truncate ${claimColor(r.finalClaim)}`}>
            {r.finalClaim}
          </p>

          {/* Score bar */}
          {scoreBar(r.weightedScore)}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-600">
            <span>
              {r.supportCount}/{r.totalProposals} agents agreed
            </span>
            <span className="font-mono truncate max-w-[120px]" title={r.commitHash}>
              {r.commitHash.slice(0, 10)}…
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
