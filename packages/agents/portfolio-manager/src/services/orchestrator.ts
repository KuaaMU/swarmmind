import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import {
  createX402Client,
  type AgentWallet,
  type UserStrategy,
  type TradingSignal,
  type RiskAssessment,
  type TradeExecution,
  type PaymentRecord,
  type ApiResponse,
  type WsMessageType,
} from "@swarmmind/shared";
import { PortfolioStateManager } from "./portfolio-state";

const ALPHA_SCOUT_URL = "http://localhost:3001";
const RISK_ORACLE_URL = "http://localhost:3002";
const TRADE_EXECUTOR_URL = "http://localhost:3003";

const LOOP_INTERVAL_MS = 30_000;
const MIN_SIGNAL_CONFIDENCE = 0.5;

export class Orchestrator extends EventEmitter {
  private readonly state: PortfolioStateManager;
  private readonly wallet: AgentWallet;
  private readonly facilitatorUrl: string;
  private strategy: UserStrategy | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(wallet: AgentWallet, facilitatorUrl: string, state: PortfolioStateManager) {
    super();
    this.wallet = wallet;
    this.facilitatorUrl = facilitatorUrl;
    this.state = state;
  }

  setStrategy(strategy: UserStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): UserStrategy | null { return this.strategy; }
  isRunning(): boolean { return this.running; }

  start(strategy: UserStrategy): void {
    if (this.running) return;
    this.strategy = strategy;
    this.running = true;
    console.log("[Orchestrator] Starting orchestration loop");
    this.loopTimer = setInterval(() => {
      this.runOnce().catch((err) => console.error("[Orchestrator] Loop error:", err));
    }, LOOP_INTERVAL_MS);
    this.runOnce().catch((err) => console.error("[Orchestrator] Initial run error:", err));
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null; }
    console.log("[Orchestrator] Stopped");
  }

  async runOnce(): Promise<void> {
    if (!this.strategy) { console.warn("[Orchestrator] No strategy set"); return; }
    const client = createX402Client(this.wallet, this.facilitatorUrl);
    console.log("[Orchestrator] Starting cycle...");

    const signals = await this.fetchSignals(client);
    if (signals.length === 0) { console.log("[Orchestrator] No signals"); return; }

    const confidentSignals = signals.filter((s) => s.confidence > MIN_SIGNAL_CONFIDENCE);
    console.log(`[Orchestrator] ${confidentSignals.length}/${signals.length} above confidence threshold`);

    for (const signal of confidentSignals) { await this.processSignal(client, signal); }
    this.broadcast("PORTFOLIO_UPDATE", this.state.getState());
  }

  private async fetchSignals(
    client: ReturnType<typeof createX402Client>,
  ): Promise<readonly TradingSignal[]> {
    try {
      const response = await client.get(`${ALPHA_SCOUT_URL}/signals/latest`);
      const body = (await response.json()) as ApiResponse<TradingSignal[]>;
      if (!body.success || !body.data) return [];

      for (const signal of body.data) {
        this.state.addSignal(signal);
        this.broadcast("SIGNAL_DETECTED", signal);
      }
      return body.data;
    } catch (err) {
      console.error("[Orchestrator] Failed to fetch signals:", err);
      return [];
    }
  }

  private async processSignal(
    client: ReturnType<typeof createX402Client>,
    signal: TradingSignal,
  ): Promise<void> {
    const assessment = await this.assessRisk(client, signal);
    if (!assessment) return;

    const maxRisk = this.getRiskThreshold();
    if (assessment.riskScore > maxRisk || assessment.recommendation === "REJECT") {
      console.log(`[Orchestrator] Signal ${signal.id} rejected (risk: ${assessment.riskScore})`);
      return;
    }
    await this.executeTrade(signal);
  }

  private async assessRisk(
    client: ReturnType<typeof createX402Client>,
    signal: TradingSignal,
  ): Promise<RiskAssessment | null> {
    try {
      const response = await client.post(`${RISK_ORACLE_URL}/assess/trade`, signal);
      const body = (await response.json()) as ApiResponse<RiskAssessment>;
      if (!body.success || !body.data) return null;

      this.state.addAssessment(body.data);
      this.broadcast("RISK_ASSESSED", body.data);
      return body.data;
    } catch (err) {
      console.error("[Orchestrator] Failed to assess risk:", err);
      return null;
    }
  }

  private async executeTrade(signal: TradingSignal): Promise<void> {
    try {
      const amount = String(this.strategy?.maxPositionSize ?? 100);
      const tradeRequest = {
        signalId: signal.id,
        tokenPair: signal.tokenPair,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        amount,
      };

      const response = await fetch(`${TRADE_EXECUTOR_URL}/execute/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": this.wallet.address },
        body: JSON.stringify(tradeRequest),
      });
      const body = (await response.json()) as ApiResponse<TradeExecution>;
      if (!body.success || !body.data) return;

      this.state.addTrade(body.data);
      this.broadcast("TRADE_EXECUTED", body.data);

      const payment: PaymentRecord = {
        id: uuidv4(),
        from: this.wallet.address,
        to: "trade-executor",
        amount,
        serviceType: "TRADE_EXECUTION",
        txHash: body.data.txHash,
        timestamp: Date.now(),
      };
      this.state.addPayment(payment);
      this.broadcast("PAYMENT_MADE", payment);
      console.log(`[Orchestrator] Trade executed: ${body.data.id} (${body.data.status})`);
    } catch (err) {
      console.error("[Orchestrator] Failed to execute trade:", err);
    }
  }

  private getRiskThreshold(): number {
    const thresholds: Record<string, number> = { LOW: 3, MEDIUM: 5, HIGH: 7 };
    return thresholds[this.strategy?.riskTolerance ?? "MEDIUM"] ?? 5;
  }

  private broadcast(type: WsMessageType, data: unknown): void {
    this.emit("ws", { type, data, timestamp: Date.now() });
  }
}
