import { describe, it, expect, vi, beforeEach } from "vitest";
import { PortfolioStateManager } from "../services/portfolio-state";
import * as fs from "fs";
import type {
  TradingSignal,
  TradeExecution,
  PaymentRecord,
  AgentStatus,
} from "@swarmmind/shared";

// Mock fs to prevent actual disk writes during tests
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue("{}"),
  writeFileSync: vi.fn(),
}));

function makeSignal(id: string): TradingSignal {
  return {
    id,
    type: "MOMENTUM",
    tokenPair: "OKB/USDC",
    direction: "BUY",
    confidence: 0.8,
    entryPrice: 52,
    targetPrice: 55,
    stopLoss: 50,
    rationale: "test",
    timestamp: Date.now(),
    source: "alpha-scout",
  };
}

function makeTrade(id: string, status: "COMPLETED" | "FAILED" = "COMPLETED"): TradeExecution {
  return {
    id,
    signalId: "sig-1",
    tokenIn: "0xUSDC",
    tokenOut: "0xOKB",
    amountIn: "100",
    amountOut: "1.92",
    txHash: "0xTx" + id,
    status,
    timestamp: Date.now(),
  };
}

function makePayment(id: string): PaymentRecord {
  return {
    id,
    from: "0xManager",
    to: "0xScout",
    amount: "0.001",
    serviceType: "SIGNAL",
    txHash: "0xPay" + id,
    timestamp: Date.now(),
  };
}

function makeAgentStatus(name: string): AgentStatus {
  return {
    name,
    role: "SCOUT",
    address: "0x" + name,
    isOnline: true,
    walletBalance: "0.2",
    totalEarnings: "0.01",
    totalSpending: "0",
    lastActivity: Date.now(),
  };
}

describe("PortfolioStateManager", () => {
  let manager: PortfolioStateManager;

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    manager = new PortfolioStateManager();
  });

  describe("addSignal", () => {
    it("stores trading signals", () => {
      manager.addSignal(makeSignal("s1"));
      manager.addSignal(makeSignal("s2"));

      expect(manager.getSignals()).toHaveLength(2);
    });

    it("limits to 50 recent signals", () => {
      for (let i = 0; i < 55; i++) {
        manager.addSignal(makeSignal(`s-${i}`));
      }

      expect(manager.getSignals()).toHaveLength(50);
    });

    it("persists to disk on each add", () => {
      manager.addSignal(makeSignal("s1"));

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("addTrade", () => {
    it("stores trade executions", () => {
      manager.addTrade(makeTrade("t1"));

      const state = manager.getState();
      expect(state.recentTrades).toHaveLength(1);
    });
  });

  describe("addPayment", () => {
    it("stores payment records", () => {
      manager.addPayment(makePayment("p1"));

      const state = manager.getState();
      expect(state.recentPayments).toHaveLength(1);
    });
  });

  describe("updateAgentStatus", () => {
    it("adds new agent status", () => {
      manager.updateAgentStatus(makeAgentStatus("alpha-scout"));

      const state = manager.getState();
      expect(state.agentStatuses).toHaveLength(1);
      expect(state.agentStatuses[0].name).toBe("alpha-scout");
    });

    it("updates existing agent status by name", () => {
      manager.updateAgentStatus(makeAgentStatus("alpha-scout"));
      manager.updateAgentStatus({
        ...makeAgentStatus("alpha-scout"),
        isOnline: false,
      });

      const state = manager.getState();
      expect(state.agentStatuses).toHaveLength(1);
      expect(state.agentStatuses[0].isOnline).toBe(false);
    });
  });

  describe("getState", () => {
    it("returns full portfolio state", () => {
      manager.addTrade(makeTrade("t1", "COMPLETED"));
      manager.addPayment(makePayment("p1"));

      const state = manager.getState();

      expect(state.totalValue).toBeGreaterThan(0);
      expect(state.recentTrades).toHaveLength(1);
      expect(state.recentPayments).toHaveLength(1);
      expect(state.positions).toEqual([]);
    });

    it("computes total value from completed trades", () => {
      manager.addTrade(makeTrade("t1", "COMPLETED"));
      manager.addTrade(makeTrade("t2", "FAILED"));

      const state = manager.getState();
      expect(state.totalValue).toBeCloseTo(1.92, 2); // only completed trade
    });
  });

  describe("loadFromDisk", () => {
    it("loads persisted state when file exists", () => {
      const persisted = {
        signals: [makeSignal("loaded")],
        assessments: [],
        trades: [],
        payments: [],
        agentStatuses: [],
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(persisted));

      const loaded = new PortfolioStateManager();
      expect(loaded.getSignals()).toHaveLength(1);
      expect(loaded.getSignals()[0].id).toBe("loaded");
    });

    it("returns empty state when file doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const loaded = new PortfolioStateManager();
      expect(loaded.getSignals()).toHaveLength(0);
    });
  });
});
