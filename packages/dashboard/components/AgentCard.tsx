"use client";

import type { AgentStatus, AgentRole } from "../lib/types";
import { AgentIcon } from "./icons/AgentIcon";
import { StatusIcon } from "./icons/StatusIcon";

const roleColors: Record<string, { border: string; glow: string; text: string }> = {
  SCOUT: { border: "border-blue-500/20", glow: "glow-border-blue", text: "text-blue-400" },
  ORACLE: { border: "border-yellow-500/20", glow: "glow-border-yellow", text: "text-yellow-400" },
  EXECUTOR: { border: "border-green-500/20", glow: "glow-border-green", text: "text-green-400" },
  MANAGER: { border: "border-purple-500/20", glow: "glow-border-purple", text: "text-purple-400" },
};

export function AgentCardComponent({
  agent,
  detailed = false,
}: {
  agent: AgentStatus;
  detailed?: boolean;
}) {
  const colors = roleColors[agent.role] || roleColors.SCOUT;
  const shortAddr = agent.address
    ? `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`
    : "---";
  const lastActive = agent.lastActivity
    ? new Date(agent.lastActivity).toLocaleTimeString()
    : "Never";

  return (
    <div
      className={`rounded-xl border ${colors.border} bg-gray-900/40 p-4 transition-all hover:bg-gray-900/60 ${
        agent.isOnline ? colors.glow : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon status={agent.isOnline ? "online" : "offline"} size={12} />
          <span className="text-xs text-gray-400">
            {agent.isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <AgentIcon role={agent.role as AgentRole} size={20} />
      </div>

      <h3 className="text-lg font-semibold text-white mb-0.5">{agent.name}</h3>
      <p className={`text-xs font-mono mb-3 ${colors.text}`}>
        {agent.role} <span className="text-gray-600 ml-1">{shortAddr}</span>
      </p>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Balance</span>
          <span className="text-white font-medium">{agent.walletBalance} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Earnings</span>
          <span className="text-green-400">{agent.totalEarnings} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Spending</span>
          <span className="text-red-400">{agent.totalSpending} USDC</span>
        </div>
      </div>

      {detailed && (
        <div className="mt-3 pt-3 border-t border-gray-800/50">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Last active</span>
            <span className="text-gray-400">{lastActive}</span>
          </div>
        </div>
      )}
    </div>
  );
}
