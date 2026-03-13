"use client";

import { usePortfolioData } from "../../hooks/usePortfolioData";
import { TopBar } from "../../components/TopBar";
import { AgentCardComponent } from "../../components/AgentCard";

export default function AgentsPage() {
  const { agents, connectionStatus, orchestrationStep } = usePortfolioData();

  const speedLabels: Record<string, string> = {
    IDLE: "Waiting...",
    SIGNAL_DETECTED: "Scanning markets",
    RISK_ASSESSED: "Assessing risk",
    TRADE_EXECUTED: "Executing trade",
    PAYMENT_MADE: "Settling payments",
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Agents"
        subtitle="Monitor and manage SwarmMind AI agents"
        connectionStatus={connectionStatus}
      />

      <div className="p-6 space-y-6">
        {/* Orchestration Control Panel */}
        <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Orchestration Control
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {connectionStatus === "demo"
                  ? "Running in demo mode with simulated data"
                  : "Connected to live orchestration engine"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 animate-fade-in" key={orchestrationStep}>
                {speedLabels[orchestrationStep] || ""}
              </span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                  Running
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 rounded-full transition-all duration-500"
              style={{
                width:
                  orchestrationStep === "IDLE" ? "0%" :
                  orchestrationStep === "SIGNAL_DETECTED" ? "25%" :
                  orchestrationStep === "RISK_ASSESSED" ? "50%" :
                  orchestrationStep === "TRADE_EXECUTED" ? "75%" :
                  "100%",
              }}
            />
          </div>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {agents.map((agent) => (
            <AgentCardComponent key={agent.name} agent={agent} detailed />
          ))}
        </div>
      </div>
    </div>
  );
}
