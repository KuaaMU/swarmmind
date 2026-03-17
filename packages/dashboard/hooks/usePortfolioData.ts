"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  AgentStatus,
  Payment,
  Trade,
  TradingSignal,
  PortfolioSummary,
  PortfolioData,
  ConsensusRound,
  LiquidityPoolDash,
} from "../lib/types";
import { useDemoMode } from "./useDemoMode";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const DEMO_ONLY = process.env.NEXT_PUBLIC_DEMO_ONLY === "true";

type ConnectionStatus = "live" | "demo" | "offline";

interface PortfolioHookResult extends PortfolioData {
  connectionStatus: ConnectionStatus;
  orchestrationStep: string;
  consensusRounds: ConsensusRound[];
  liquidityPools: LiquidityPoolDash[];
}

function useRealData(): {
  data: PortfolioData | null;
  connectionStatus: ConnectionStatus;
} {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    DEMO_ONLY ? "demo" : "offline"
  );

  const fetchPortfolio = useCallback(async () => {
    if (DEMO_ONLY) return;
    try {
      const res = await fetch(`${API_BASE}/portfolio`);
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      const agentStatuses: AgentStatus[] = json.data?.agentStatuses || [];
      setData({
        summary: {
          totalValue: json.data?.totalValue || 0,
          pnl24h: 0,
          activeAgents: agentStatuses.filter((a: AgentStatus) => a.isOnline).length,
          totalPayments: json.data?.recentPayments?.length || 0,
        },
        agents: agentStatuses,
        payments: json.data?.recentPayments || [],
        trades: json.data?.recentTrades || [],
        signals: [],
        isDemo: false,
      });
      setConnectionStatus("live");
    } catch {
      setConnectionStatus("offline");
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (DEMO_ONLY) return;

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);

    let ws: WebSocket | null = null;
    try {
      const wsUrl = API_BASE.replace("http", "ws");
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setConnectionStatus("live");
      ws.onclose = () => {
        if (connectionStatus === "live") setConnectionStatus("offline");
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        setData((prev) => {
          if (!prev) return prev;
          if (msg.type === "PAYMENT_MADE") {
            return { ...prev, payments: [msg.data, ...prev.payments].slice(0, 50) };
          }
          if (msg.type === "TRADE_EXECUTED") {
            return { ...prev, trades: [msg.data, ...prev.trades].slice(0, 50) };
          }
          if (msg.type === "AGENT_STATUS") {
            return {
              ...prev,
              agents: prev.agents.map((a) =>
                a.name === msg.data.name ? msg.data : a
              ),
            };
          }
          return prev;
        });
      };
    } catch {
      // WebSocket not available
    }

    return () => {
      clearInterval(interval);
      ws?.close();
    };
  }, [fetchPortfolio]);

  return { data, connectionStatus };
}

export function usePortfolioData(): PortfolioHookResult {
  const { data: realData, connectionStatus: realStatus } = useRealData();
  const demoData = useDemoMode();

  // If real API is live, use real data
  if (realStatus === "live" && realData) {
    return {
      ...realData,
      connectionStatus: "live",
      orchestrationStep: "IDLE",
      consensusRounds: [],
      liquidityPools: [],
    };
  }

  // Otherwise, use demo data
  return {
    summary: demoData.summary,
    agents: demoData.agents,
    payments: demoData.payments,
    trades: demoData.trades,
    signals: demoData.signals,
    isDemo: true,
    connectionStatus: "demo",
    orchestrationStep: demoData.orchestrationStep,
    consensusRounds: demoData.consensusRounds,
    liquidityPools: demoData.liquidityPools,
  };
}
