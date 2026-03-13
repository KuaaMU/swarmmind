import * as fs from "fs";
import * as path from "path";
import type {
  TradingSignal,
  RiskAssessment,
  TradeExecution,
  PaymentRecord,
  PortfolioState,
  AgentStatus,
} from "@swarmmind/shared";

const STATE_FILE = path.resolve(__dirname, "../../portfolio-state.json");
const MAX_RECENT_ITEMS = 50;

interface PersistedState {
  readonly signals: readonly TradingSignal[];
  readonly assessments: readonly RiskAssessment[];
  readonly trades: readonly TradeExecution[];
  readonly payments: readonly PaymentRecord[];
  readonly agentStatuses: readonly AgentStatus[];
}

export class PortfolioStateManager {
  private signals: readonly TradingSignal[];
  private assessments: readonly RiskAssessment[];
  private trades: readonly TradeExecution[];
  private payments: readonly PaymentRecord[];
  private agentStatuses: readonly AgentStatus[];

  constructor() {
    const restored = this.loadFromDisk();
    this.signals = restored.signals;
    this.assessments = restored.assessments;
    this.trades = restored.trades;
    this.payments = restored.payments;
    this.agentStatuses = restored.agentStatuses;
  }

  addSignal(signal: TradingSignal): void {
    this.signals = [...this.signals, signal].slice(-MAX_RECENT_ITEMS);
    this.persistToDisk();
  }

  addAssessment(assessment: RiskAssessment): void {
    this.assessments = [...this.assessments, assessment].slice(-MAX_RECENT_ITEMS);
    this.persistToDisk();
  }

  addTrade(trade: TradeExecution): void {
    this.trades = [...this.trades, trade].slice(-MAX_RECENT_ITEMS);
    this.persistToDisk();
  }

  addPayment(payment: PaymentRecord): void {
    this.payments = [...this.payments, payment].slice(-MAX_RECENT_ITEMS);
    this.persistToDisk();
  }

  updateAgentStatus(status: AgentStatus): void {
    const existing = this.agentStatuses.findIndex(
      (s) => s.name === status.name,
    );

    if (existing >= 0) {
      this.agentStatuses = this.agentStatuses.map((s, i) =>
        i === existing ? status : s,
      );
    } else {
      this.agentStatuses = [...this.agentStatuses, status];
    }
    this.persistToDisk();
  }

  getState(): PortfolioState {
    return {
      totalValue: this.computeTotalValue(),
      positions: [],
      recentTrades: this.trades,
      recentPayments: this.payments,
      agentStatuses: this.agentStatuses,
    };
  }

  getSignals(): readonly TradingSignal[] {
    return this.signals;
  }

  getAssessments(): readonly RiskAssessment[] {
    return this.assessments;
  }

  private computeTotalValue(): number {
    const completedTrades = this.trades.filter(
      (t) => t.status === "COMPLETED",
    );
    return completedTrades.reduce((total, trade) => {
      return total + parseFloat(trade.amountOut || "0");
    }, 0);
  }

  private persistToDisk(): void {
    const state: PersistedState = {
      signals: this.signals,
      assessments: this.assessments,
      trades: this.trades,
      payments: this.payments,
      agentStatuses: this.agentStatuses,
    };

    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    } catch (err) {
      console.error("[PortfolioState] Failed to persist state:", err);
    }
  }

  private loadFromDisk(): PersistedState {
    const empty: PersistedState = {
      signals: [],
      assessments: [],
      trades: [],
      payments: [],
      agentStatuses: [],
    };

    try {
      if (!fs.existsSync(STATE_FILE)) {
        return empty;
      }
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PersistedState>;

      return {
        signals: Array.isArray(parsed.signals) ? parsed.signals : [],
        assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        agentStatuses: Array.isArray(parsed.agentStatuses) ? parsed.agentStatuses : [],
      };
    } catch (err) {
      console.error("[PortfolioState] Failed to load persisted state:", err);
      return empty;
    }
  }
}
