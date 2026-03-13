"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentCardComponent } from "../../components/AgentCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      if (!res.ok) return;
      const data = await res.json();
      setAgents(data.data || []);
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Agent Management</h1>
        <p className="text-gray-400">Monitor and manage SwarmMind AI agents</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {agents.length > 0 ? (
          agents.map((agent) => (
            <AgentCardComponent key={agent.name} agent={agent} detailed />
          ))
        ) : (
          <>
            <PlaceholderAgent name="Alpha Scout" role="SCOUT" color="blue" />
            <PlaceholderAgent name="Risk Oracle" role="ORACLE" color="yellow" />
            <PlaceholderAgent name="Trade Executor" role="EXECUTOR" color="green" />
            <PlaceholderAgent name="Portfolio Manager" role="MANAGER" color="purple" />
          </>
        )}
      </div>
    </div>
  );
}

function PlaceholderAgent({
  name,
  role,
  color,
}: {
  name: string;
  role: string;
  color: string;
}) {
  const borderColors: Record<string, string> = {
    blue: "border-blue-500/20",
    yellow: "border-yellow-500/20",
    green: "border-green-500/20",
    purple: "border-purple-500/20",
  };

  return (
    <div className={`rounded-xl border ${borderColors[color]} bg-gray-900/50 p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-gray-600" />
        <span className="text-sm text-gray-500">Offline</span>
      </div>
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="text-sm text-gray-400 mb-4">{role}</p>
      <div className="space-y-2 text-sm text-gray-500">
        <p>Balance: --</p>
        <p>Earnings: --</p>
        <p>Spending: --</p>
      </div>
    </div>
  );
}
