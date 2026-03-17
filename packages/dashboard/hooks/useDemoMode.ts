"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AgentStatus,
  Payment,
  Trade,
  TradingSignal,
  PortfolioSummary,
} from "../lib/types";
import {
  createDemoAgents,
  createDemoSignal,
  createDemoRiskAssessment,
  createDemoPayment,
  createDemoTrade,
  createInitialPayments,
  createInitialTrades,
} from "../lib/demo-data";

interface DemoState {
  agents: AgentStatus[];
  payments: Payment[];
  trades: Trade[];
  signals: TradingSignal[];
  summary: PortfolioSummary;
  isDemo: true;
}

type OrchestrationStep =
  | "IDLE"
  | "SIGNAL_DETECTED"
  | "RISK_ASSESSED"
  | "TRADE_EXECUTED"
  | "PAYMENT_MADE";

export function useDemoMode(): DemoState & { orchestrationStep: OrchestrationStep } {
  const [agents, setAgents] = useState<AgentStatus[]>(() => createDemoAgents());
  const [payments, setPayments] = useState<Payment[]>(() => createInitialPayments());
  const [trades, setTrades] = useState<Trade[]>(() => createInitialTrades());
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [orchestrationStep, setOrchestrationStep] = useState<OrchestrationStep>("IDLE");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAgentFinancials = useCallback(
    (receiverName: string, senderName: string, amount: number) => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.name === receiverName) {
            const newEarnings = parseFloat(a.totalEarnings) + amount;
            const newBalance = parseFloat(a.walletBalance) + amount;
            return {
              ...a,
              totalEarnings: newEarnings.toFixed(4),
              walletBalance: newBalance.toFixed(4),
              lastActivity: Date.now(),
              isOnline: true,
            };
          }
          if (a.name === senderName) {
            const newSpending = parseFloat(a.totalSpending) + amount;
            const newBalance = Math.max(0, parseFloat(a.walletBalance) - amount);
            return {
              ...a,
              totalSpending: newSpending.toFixed(4),
              walletBalance: newBalance.toFixed(4),
              lastActivity: Date.now(),
              isOnline: true,
            };
          }
          return a;
        })
      );
    },
    []
  );

  const updateAgentActivity = useCallback((agentName: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.name === agentName
          ? { ...a, lastActivity: Date.now(), isOnline: true }
          : a
      )
    );
  }, []);

  const runOrchestrationCycle = useCallback(() => {
    // Step 1: Signal detected
    const signal = createDemoSignal();
    setSignals((prev) => [signal, ...prev].slice(0, 20));
    setOrchestrationStep("SIGNAL_DETECTED");
    updateAgentActivity("Alpha Scout");

    // Step 2: Risk assessed (after 2s)
    timeoutRef.current = setTimeout(() => {
      createDemoRiskAssessment(signal.id);
      setOrchestrationStep("RISK_ASSESSED");
      updateAgentActivity("Risk Oracle");

      const paymentToOracle = createDemoPayment(
        "portfolio-manager",
        "risk-oracle",
        "RISK_ASSESSMENT"
      );
      setPayments((prev) => [paymentToOracle, ...prev].slice(0, 50));
      updateAgentFinancials("Risk Oracle", "Portfolio Manager", 0.002);

      // Step 3: Trade executed (after another 2s)
      timeoutRef.current = setTimeout(() => {
        const trade = createDemoTrade(signal.id);
        setTrades((prev) => [trade, ...prev].slice(0, 50));
        setOrchestrationStep("TRADE_EXECUTED");
        updateAgentActivity("Trade Executor");

        // Step 4: Payment made (after 1s)
        timeoutRef.current = setTimeout(() => {
          const paymentToScout = createDemoPayment(
            "portfolio-manager",
            "alpha-scout",
            "SIGNAL_ANALYSIS"
          );
          setPayments((prev) => [paymentToScout, ...prev].slice(0, 50));
          updateAgentFinancials("Alpha Scout", "Portfolio Manager", 0.001);
          setOrchestrationStep("PAYMENT_MADE");

          // Reset to idle after 1s
          timeoutRef.current = setTimeout(() => {
            setOrchestrationStep("IDLE");
          }, 1000);
        }, 1000);
      }, 2000);
    }, 2000);
  }, [updateAgentActivity, updateAgentFinancials]);

  useEffect(() => {
    // Start first cycle after 2s
    const initialDelay = setTimeout(() => {
      runOrchestrationCycle();
    }, 2000);

    // Run cycles every 6-10s
    const interval = setInterval(() => {
      runOrchestrationCycle();
    }, Math.floor(Math.random() * 4000) + 6000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [runOrchestrationCycle]);

  const summary: PortfolioSummary = {
    totalValue: agents.reduce((sum, a) => sum + parseFloat(a.walletBalance || "0"), 0),
    pnl24h: parseFloat((Math.random() * 0.5 - 0.1).toFixed(4)),
    activeAgents: agents.filter((a) => a.isOnline).length,
    totalPayments: payments.length,
  };

  return {
    agents,
    payments,
    trades,
    signals,
    summary,
    isDemo: true,
    orchestrationStep,
  };
}
