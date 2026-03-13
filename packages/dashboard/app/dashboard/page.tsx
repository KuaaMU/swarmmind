"use client";

import { usePortfolioData } from "../../hooks/usePortfolioData";
import { TopBar } from "../../components/TopBar";
import { SummaryCard } from "../../components/SummaryCard";
import { AgentCardComponent } from "../../components/AgentCard";
import { PaymentFeed } from "../../components/PaymentFeed";
import { SwarmVisualization } from "../../components/SwarmVisualization";
import { TradeHistory } from "../../components/TradeHistory";
import { AgentIcon } from "../../components/icons/AgentIcon";

export default function DashboardPage() {
  const {
    summary,
    agents,
    payments,
    trades,
    connectionStatus,
    orchestrationStep,
  } = usePortfolioData();

  const stepLabels: Record<string, string> = {
    IDLE: "Waiting for signals...",
    SIGNAL_DETECTED: "Signal detected - scanning markets",
    RISK_ASSESSED: "Risk assessment complete",
    TRADE_EXECUTED: "Trade executed on DEX",
    PAYMENT_MADE: "Micropayments settled",
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Dashboard"
        subtitle="Real-time swarm intelligence overview"
        connectionStatus={connectionStatus}
      />

      <div className="p-6 space-y-6">
        {/* Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Value"
            value={`$${summary.totalValue.toFixed(2)}`}
            icon={<AgentIcon role="MANAGER" size={20} />}
            glowColor="purple"
          />
          <SummaryCard
            title="24h P&L"
            value={`${summary.pnl24h >= 0 ? "+" : ""}$${summary.pnl24h.toFixed(4)}`}
            valueColor={summary.pnl24h >= 0 ? "text-green-400" : "text-red-400"}
            icon={<AgentIcon role="EXECUTOR" size={20} />}
            glowColor="green"
          />
          <SummaryCard
            title="Active Agents"
            value={`${summary.activeAgents}/4`}
            subtitle="All systems operational"
            icon={<AgentIcon role="SCOUT" size={20} />}
            glowColor="blue"
          />
          <SummaryCard
            title="Total Payments"
            value={`${summary.totalPayments}`}
            subtitle="x402 micropayments"
            icon={<AgentIcon role="ORACLE" size={20} />}
            glowColor="yellow"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Swarm Visualization - takes 2/3 */}
          <div className="lg:col-span-2 bg-gray-900/30 rounded-xl border border-gray-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Agent Network</h2>
              <span className="text-xs text-gray-500 animate-fade-in" key={orchestrationStep}>
                {stepLabels[orchestrationStep] || ""}
              </span>
            </div>
            <div className="h-[460px]">
              <SwarmVisualization agents={agents} payments={payments} />
            </div>
          </div>

          {/* Right column: Payment Feed + Trade History stacked */}
          <div className="space-y-6">
            <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Payment Feed</h2>
              <PaymentFeed payments={payments} />
            </div>
            <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Recent Trades</h2>
              <TradeHistory trades={trades} />
            </div>
          </div>
        </div>

        {/* Agent Cards Row */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Agent Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <AgentCardComponent key={agent.name} agent={agent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
