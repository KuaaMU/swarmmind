"use client";

interface AgentStatus {
  name: string;
  role: string;
  address: string;
  isOnline: boolean;
  walletBalance: string;
  totalEarnings: string;
  totalSpending: string;
  lastActivity: number;
}

const roleColors: Record<string, { border: string; dot: string; text: string }> = {
  SCOUT: { border: "border-blue-500/30", dot: "bg-blue-400", text: "text-blue-400" },
  ORACLE: { border: "border-yellow-500/30", dot: "bg-yellow-400", text: "text-yellow-400" },
  EXECUTOR: { border: "border-green-500/30", dot: "bg-green-400", text: "text-green-400" },
  MANAGER: { border: "border-purple-500/30", dot: "bg-purple-400", text: "text-purple-400" },
};

export function AgentCardComponent({
  agent,
  detailed = false,
}: {
  agent: AgentStatus;
  detailed?: boolean;
}) {
  const colors = roleColors[agent.role] || roleColors.SCOUT;
  const shortAddr = `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`;
  const lastActive = agent.lastActivity
    ? new Date(agent.lastActivity).toLocaleTimeString()
    : "Never";

  return (
    <div className={`rounded-xl border ${colors.border} bg-gray-900/50 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              agent.isOnline ? colors.dot : "bg-gray-600"
            }`}
          />
          <span className="text-sm text-gray-400">
            {agent.isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <span className={`text-xs font-mono ${colors.text}`}>{agent.role}</span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
      <p className="text-xs text-gray-500 font-mono mb-3">{shortAddr}</p>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Balance</span>
          <span className="text-white">{agent.walletBalance} USDC</span>
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
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Last active</span>
            <span className="text-gray-400">{lastActive}</span>
          </div>
        </div>
      )}
    </div>
  );
}
