"use client";

import { usePortfolioData } from "../../hooks/usePortfolioData";
import { TopBar } from "../../components/TopBar";
import { SummaryCard } from "../../components/SummaryCard";
import { PaymentFeed } from "../../components/PaymentFeed";
import { PaymentVolumeChart } from "../../components/charts/PaymentVolumeChart";
import { AgentEarningsChart } from "../../components/charts/AgentEarningsChart";

export default function PaymentsPage() {
  const { payments, agents, connectionStatus } = usePortfolioData();

  const totalVolume = payments.reduce(
    (sum, p) => sum + parseFloat(p.amount || "0"),
    0
  );

  return (
    <div className="min-h-screen">
      <TopBar
        title="Payments"
        subtitle="x402 micropayment analytics"
        connectionStatus={connectionStatus}
      />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title="Total Payments"
            value={`${payments.length}`}
            subtitle="All-time transactions"
            glowColor="purple"
          />
          <SummaryCard
            title="Total Volume"
            value={`$${totalVolume.toFixed(4)}`}
            subtitle="USDC settled"
            glowColor="green"
          />
          <SummaryCard
            title="Network"
            value="X Layer"
            subtitle="Chain ID 196"
            glowColor="blue"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Payment Volume
            </h2>
            <PaymentVolumeChart payments={payments} />
          </div>
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Agent Earnings vs Spending
            </h2>
            <AgentEarningsChart agents={agents} />
          </div>
        </div>

        {/* Payment Flow + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Payment Flow
            </h2>
            <div className="space-y-3">
              <FlowRow from="Portfolio Manager" to="Alpha Scout" service="Market Signals" price="$0.001" color="blue" />
              <FlowRow from="Portfolio Manager" to="Risk Oracle" service="Risk Assessment" price="$0.002" color="yellow" />
              <FlowRow from="Portfolio Manager" to="Trade Executor" service="DEX Swap" price="Direct Call" color="green" />
            </div>
          </div>
          <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Recent Payments
            </h2>
            <PaymentFeed payments={payments} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowRow({
  from,
  to,
  service,
  price,
  color,
}: {
  from: string;
  to: string;
  service: string;
  price: string;
  color: string;
}) {
  const dotColors: Record<string, string> = {
    blue: "bg-blue-400",
    yellow: "bg-yellow-400",
    green: "bg-green-400",
    purple: "bg-purple-400",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
      <span className="text-sm font-medium text-purple-400 w-36">{from}</span>
      {/* SVG arrow */}
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
        <line x1="0" y1="6" x2="16" y2="6" stroke="#6b7280" strokeWidth="1.5" />
        <path d="M14 2l4 4-4 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className={`w-2 h-2 rounded-full ${dotColors[color] || "bg-gray-400"} shrink-0`} />
      <span className="text-sm font-medium text-blue-400 w-28">{to}</span>
      <span className="text-xs text-gray-400 flex-1">{service}</span>
      <span className="text-xs text-green-400">{price}</span>
    </div>
  );
}
