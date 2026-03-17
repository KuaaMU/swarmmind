"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AgentStatus,
  Payment,
  Trade,
  TradingSignal,
  PortfolioSummary,
  ConsensusRound,
  LiquidityPoolDash,
  ReasoningTrace,
} from "../lib/types";
import {
  createDemoAgents,
  createDemoSignal,
  createDemoRiskAssessment,
  createDemoPayment,
  createDemoTrade,
  createInitialPayments,
  createInitialTrades,
  createDemoConsensusRound,
  createInitialConsensusRounds,
  createInitialLiquidityPools,
} from "../lib/demo-data";

interface DemoState {
  agents: AgentStatus[];
  payments: Payment[];
  trades: Trade[];
  signals: TradingSignal[];
  summary: PortfolioSummary;
  consensusRounds: ConsensusRound[];
  liquidityPools: LiquidityPoolDash[];
  reasoningTrace: ReasoningTrace | null;
  activeToolCall: string | null;
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
  const [consensusRounds, setConsensusRounds] = useState<ConsensusRound[]>(
    () => createInitialConsensusRounds()
  );
  const [liquidityPools] = useState<LiquidityPoolDash[]>(
    () => createInitialLiquidityPools()
  );
  const [reasoningTrace, setReasoningTrace] = useState<ReasoningTrace | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
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
    const startedAt = Date.now();
    const traceSteps: ReasoningTrace["steps"] = [];

    // Step 1: Signal detected
    const signal = createDemoSignal();
    setSignals((prev) => [signal, ...prev].slice(0, 20));
    setOrchestrationStep("SIGNAL_DETECTED");
    setActiveToolCall("get_market_signals");
    updateAgentActivity("Alpha Scout");

    traceSteps.push({
      iteration: 0,
      text: "Let me scan the market for trading opportunities on X Layer.",
      toolCalls: [{
        name: "get_market_signals",
        input: {},
        result: JSON.stringify({ count: 1, signals: [{ id: signal.id, tokenPair: signal.tokenPair }] }),
      }],
      timestamp: Date.now(),
    });

    // Step 2: Risk assessed (after 2s)
    timeoutRef.current = setTimeout(() => {
      createDemoRiskAssessment(signal.id);
      setOrchestrationStep("RISK_ASSESSED");
      setActiveToolCall("assess_risk");
      updateAgentActivity("Risk Oracle");

      const riskScore = Math.floor(Math.random() * 4) + 2;
      traceSteps.push({
        iteration: 1,
        text: `Found signal ${signal.id} with ${(signal.confidence * 100).toFixed(0)}% confidence. Assessing risk.`,
        toolCalls: [{
          name: "assess_risk",
          input: { signal_id: signal.id },
          result: JSON.stringify({ riskScore, recommendation: riskScore <= 5 ? "PROCEED" : "CAUTION" }),
        }],
        timestamp: Date.now(),
      });

      const paymentToOracle = createDemoPayment(
        "portfolio-manager",
        "risk-oracle",
        "RISK_ASSESSMENT"
      );
      setPayments((prev) => [paymentToOracle, ...prev].slice(0, 50));
      updateAgentFinancials("Risk Oracle", "Portfolio Manager", 0.002);

      // Emit a consensus round after risk assessment
      const round = createDemoConsensusRound();
      setConsensusRounds((prev) => [round, ...prev].slice(0, 20));

      // Step 3: Trade executed (after another 2s)
      timeoutRef.current = setTimeout(() => {
        const trade = createDemoTrade(signal.id);
        setTrades((prev) => [trade, ...prev].slice(0, 50));
        setOrchestrationStep("TRADE_EXECUTED");
        setActiveToolCall("execute_trade");
        updateAgentActivity("Trade Executor");

        traceSteps.push({
          iteration: 2,
          text: `Risk score ${riskScore}/10 is acceptable. Executing trade.`,
          toolCalls: [{
            name: "execute_trade",
            input: { signal_id: signal.id, amount: "100" },
            result: JSON.stringify({ tradeId: trade.id, status: trade.status }),
          }],
          timestamp: Date.now(),
        });

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
          setActiveToolCall(null);

          traceSteps.push({
            iteration: 3,
            text: "Trade executed successfully. Cycle complete.",
            toolCalls: [],
            timestamp: Date.now(),
          });

          setReasoningTrace({
            startedAt,
            completedAt: Date.now(),
            steps: traceSteps,
            summary: `Scanned market, found ${signal.tokenPair} signal, risk score ${riskScore}/10, executed trade.`,
          });

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
    consensusRounds,
    liquidityPools,
    reasoningTrace,
    activeToolCall,
    isDemo: true,
    orchestrationStep,
  };
}
