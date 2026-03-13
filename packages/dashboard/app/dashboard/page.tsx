"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentCardComponent } from "../../components/AgentCard";
import { PaymentFeed } from "../../components/PaymentFeed";
import { SwarmVisualization } from "../../components/SwarmVisualization";
import { TradeHistory } from "../../components/TradeHistory";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PortfolioSummary {
  totalValue: number;
  pnl24h: number;
  activeAgents: number;
  totalPayments: number;
}

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

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  serviceType: string;
  txHash: string;
  timestamp: number;
}

interface Trade {
  id: string;
  signalId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  txHash: string;
  status: string;
  timestamp: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    pnl24h: 0,
    activeAgents: 0,
    totalPayments: 0,
  });
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/portfolio`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        totalValue: data.data?.totalValue || 0,
        pnl24h: 0,
        activeAgents: data.data?.agentStatuses?.filter((a: AgentStatus) => a.isOnline).length || 0,
        totalPayments: data.data?.recentPayments?.length || 0,
      });
      setAgents(data.data?.agentStatuses || []);
      setPayments(data.data?.recentPayments || []);
      setTrades(data.data?.recentTrades || []);
    } catch {
      // API not available yet
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);

    // WebSocket connection
    const wsUrl = API_BASE.replace("http", "ws");
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "PAYMENT_MADE") {
          setPayments((prev) => [msg.data, ...prev].slice(0, 50));
        } else if (msg.type === "TRADE_EXECUTED") {
          setTrades((prev) => [msg.data, ...prev].slice(0, 50));
        } else if (msg.type === "AGENT_STATUS") {
          setAgents((prev) =>
            prev.map((a) => (a.name === msg.data.name ? msg.data : a))
          );
        }
      };
    } catch {
      // WebSocket not available
    }

    return () => {
      clearInterval(interval);
      ws?.close();
    };
  }, [fetchPortfolio]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">SwarmMind Dashboard</h1>
          <p className="text-gray-400">Autonomous DeFi Intelligence on X Layer</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              wsConnected ? "bg-green-400" : "bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-400">
            {wsConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="Total Value" value={`$${summary.totalValue.toFixed(2)}`} />
        <SummaryCard
          title="24h P&L"
          value={`${summary.pnl24h >= 0 ? "+" : ""}$${summary.pnl24h.toFixed(2)}`}
          valueColor={summary.pnl24h >= 0 ? "text-green-400" : "text-red-400"}
        />
        <SummaryCard title="Active Agents" value={`${summary.activeAgents}/4`} />
        <SummaryCard title="Total Payments" value={`${summary.totalPayments}`} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Swarm Visualization */}
        <div className="lg:col-span-2 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Agent Network</h2>
          <SwarmVisualization agents={agents} payments={payments} />
        </div>

        {/* Payment Feed */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Feed</h2>
          <PaymentFeed payments={payments} />
        </div>

        {/* Agent Status */}
        <div className="lg:col-span-2 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Agent Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCardComponent key={agent.name} agent={agent} />
            ))}
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
          <TradeHistory trades={trades} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  valueColor = "text-white",
}: {
  title: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
