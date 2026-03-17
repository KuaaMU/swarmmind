"use client";

import { usePortfolioData } from "../../hooks/usePortfolioData";
import { TopBar } from "../../components/TopBar";
import { SummaryCard } from "../../components/SummaryCard";
import { ConsensusPanel } from "../../components/ConsensusPanel";
import { LiquidityPanel } from "../../components/LiquidityPanel";

export default function ConsensusPage() {
  const { consensusRounds, liquidityPools, connectionStatus } = usePortfolioData();

  const avgScore =
    consensusRounds.length > 0
      ? (
          consensusRounds.reduce((s, r) => s + r.weightedScore, 0) /
          consensusRounds.length
        ).toFixed(2)
      : "—";

  const challenged = consensusRounds.filter((r) => r.challengeOpen).length;
  const deepPools = liquidityPools.filter((p) => p.recommendation === "DEEP").length;
  const avgLiqScore =
    liquidityPools.length > 0
      ? (
          liquidityPools.reduce((s, p) => s + p.liquidityScore, 0) /
          liquidityPools.length
        ).toFixed(1)
      : "—";

  return (
    <div className="min-h-screen">
      <TopBar
        title="Consensus"
        subtitle="CRCN on-chain commit anchoring & liquidity health"
        connectionStatus={connectionStatus}
      />

      <div className="p-6 space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Consensus Rounds"
            value={`${consensusRounds.length}`}
            subtitle="Total this session"
            glowColor="purple"
          />
          <SummaryCard
            title="Avg Weighted Score"
            value={`${avgScore}`}
            subtitle="CRCN confidence"
            glowColor="blue"
          />
          <SummaryCard
            title="Open Challenges"
            value={`${challenged}`}
            subtitle="Pending resolution"
            glowColor={challenged > 0 ? "yellow" : "green"}
          />
          <SummaryCard
            title="Avg Liquidity Score"
            value={avgLiqScore}
            subtitle={`${deepPools}/${liquidityPools.length} pools DEEP`}
            glowColor="green"
          />
        </div>

        {/* Panels Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consensus Feed */}
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Consensus Rounds
              </h2>
              <span className="text-xs text-gray-600">SHA-256 anchored</span>
            </div>
            <ConsensusPanel rounds={consensusRounds} />
          </div>

          {/* Liquidity Health */}
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Liquidity Health
              </h2>
              <span className="text-xs text-gray-600">Price impact @ $10k</span>
            </div>
            <LiquidityPanel pools={liquidityPools} />
          </div>
        </div>

        {/* How CRCN works */}
        <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            How CRCN Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              {
                step: "01",
                title: "Proposal",
                desc: "Agents submit claims with confidence scores and evidence pointers.",
                color: "border-blue-500/30 bg-blue-500/5",
              },
              {
                step: "02",
                title: "Consensus",
                desc: "Weighted voting with correlation penalty prevents Sybil clusters.",
                color: "border-purple-500/30 bg-purple-500/5",
              },
              {
                step: "03",
                title: "Commit",
                desc: "SHA-256 commit hash anchored to ConsensusCommit.sol on X Layer.",
                color: "border-green-500/30 bg-green-500/5",
              },
              {
                step: "04",
                title: "Challenge",
                desc: "24-hour challenge window; disputes resolved by governance multi-sig.",
                color: "border-yellow-500/30 bg-yellow-500/5",
              },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className={`rounded-lg border p-4 ${color}`}>
                <div className="text-xs font-mono text-gray-600 mb-1">Step {step}</div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{title}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
