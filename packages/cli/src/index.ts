#!/usr/bin/env node
/**
 * SwarmMind CLI
 *
 * Command-line interface for interacting with the SwarmMind agent network.
 *
 * Usage:
 *   npx swarmmind signals              # Get latest signals
 *   npx swarmmind signals --arbitrage  # Arbitrage-only signals
 *   npx swarmmind risk <signalId>      # Assess risk for a signal
 *   npx swarmmind trade <signalId>     # Execute trade
 *   npx swarmmind portfolio            # View portfolio state
 *   npx swarmmind agents               # List registered agents
 *   npx swarmmind orchestrate          # Run one ReAct cycle
 *   npx swarmmind orchestrate --start  # Start continuous orchestration
 *   npx swarmmind orchestrate --stop   # Stop orchestration
 */

import { Command } from "commander";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = process.env["SWARMMIND_URL"] || "http://localhost:3000";
const ALPHA_SCOUT_URL = process.env["ALPHA_SCOUT_URL"] || "http://localhost:3001";
const RISK_ORACLE_URL = process.env["RISK_ORACLE_URL"] || "http://localhost:3002";
const TRADE_EXECUTOR_URL = process.env["TRADE_EXECUTOR_URL"] || "http://localhost:3003";

// ─── HTTP Helper ────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return (await response.json()) as ApiResponse<T>;
  } catch (err) {
    return { success: false, data: null, error: `Connection failed: ${String(err)}` };
  }
}

// ─── Output Helpers ─────────────────────────────────────────────────────────

function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatData(data));
  }
}

function formatData(data: unknown, indent = 0): string {
  if (data === null || data === undefined) return "null";
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);

  if (Array.isArray(data)) {
    if (data.length === 0) return "(empty)";
    return data.map((item, i) => `  ${" ".repeat(indent)}${i + 1}. ${formatData(item, indent + 2)}`).join("\n");
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return entries
      .map(([key, val]) => {
        const valStr = typeof val === "object" && val !== null
          ? `\n${formatData(val, indent + 2)}`
          : ` ${formatData(val)}`;
        return `${" ".repeat(indent)}${key}:${valStr}`;
      })
      .join("\n");
  }

  return String(data);
}

function errorExit(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// ─── CLI Program ────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("swarmmind")
  .description("SwarmMind - Multi-agent DeFi intelligence network on X Layer")
  .version("0.1.0")
  .option("--json", "Output as JSON");

// ── signals ─────────────────────────────────────────────────────────────────

program
  .command("signals")
  .description("Get latest trading signals from Alpha Scout")
  .option("--arbitrage", "Filter for ARBITRAGE signals only")
  .option("--momentum", "Filter for MOMENTUM signals only")
  .option("--reversion", "Filter for MEAN_REVERSION signals only")
  .action(async (opts) => {
    const jsonMode = program.opts().json;
    const result = await fetchAPI<unknown[]>(`${ALPHA_SCOUT_URL}/signals/latest`);

    if (!result.success || !result.data) {
      errorExit(result.error || "No signals available");
    }

    let signals = result.data as Array<Record<string, unknown>>;
    if (opts.arbitrage) signals = signals.filter((s) => s.type === "ARBITRAGE");
    if (opts.momentum) signals = signals.filter((s) => s.type === "MOMENTUM");
    if (opts.reversion) signals = signals.filter((s) => s.type === "MEAN_REVERSION");

    if (!jsonMode) {
      console.log(`\nFound ${signals.length} signal(s):\n`);
      for (const s of signals) {
        console.log(`  [${s.type}] ${s.tokenPair} ${s.direction} @ ${s.entryPrice}`);
        console.log(`    Confidence: ${s.confidence} | Target: ${s.targetPrice} | Stop: ${s.stopLoss}`);
        console.log(`    ID: ${s.id}`);
        console.log(`    ${s.rationale}\n`);
      }
    } else {
      output(signals, true);
    }
  });

// ── risk ────────────────────────────────────────────────────────────────────

program
  .command("risk <signalId>")
  .description("Assess risk for a specific signal")
  .action(async (signalId: string) => {
    const jsonMode = program.opts().json;

    // First fetch signals to find the one we need
    const signalsResult = await fetchAPI<unknown[]>(`${ALPHA_SCOUT_URL}/signals/latest`);
    if (!signalsResult.success || !signalsResult.data) {
      errorExit("Cannot fetch signals to find signal data");
    }

    const signal = (signalsResult.data as Array<Record<string, unknown>>)
      .find((s) => s.id === signalId);
    if (!signal) {
      errorExit(`Signal ${signalId} not found`);
    }

    const result = await fetchAPI<Record<string, unknown>>(`${RISK_ORACLE_URL}/assess/trade`, {
      method: "POST",
      body: JSON.stringify(signal),
    });

    if (!result.success || !result.data) {
      errorExit(result.error || "Risk assessment failed");
    }

    if (!jsonMode) {
      const d = result.data;
      console.log(`\nRisk Assessment for ${signalId}:\n`);
      console.log(`  Risk Score:     ${d.riskScore}/10`);
      console.log(`  Max Drawdown:   ${((d.maxDrawdown as number) * 100).toFixed(1)}%`);
      console.log(`  Recommendation: ${d.recommendation}`);
      console.log(`  Rationale:      ${d.rationale}\n`);
    } else {
      output(result.data, true);
    }
  });

// ── trade ───────────────────────────────────────────────────────────────────

program
  .command("trade <signalId>")
  .description("Execute trade for a signal")
  .option("-a, --amount <amount>", "Amount in USDC", "100")
  .action(async (signalId: string, opts) => {
    const jsonMode = program.opts().json;

    // Fetch the signal
    const signalsResult = await fetchAPI<unknown[]>(`${ALPHA_SCOUT_URL}/signals/latest`);
    if (!signalsResult.success || !signalsResult.data) {
      errorExit("Cannot fetch signals");
    }

    const signal = (signalsResult.data as Array<Record<string, unknown>>)
      .find((s) => s.id === signalId);
    if (!signal) {
      errorExit(`Signal ${signalId} not found`);
    }

    const tradeReq = {
      signalId: signal.id,
      tokenPair: signal.tokenPair,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      amount: opts.amount,
    };

    const result = await fetchAPI<Record<string, unknown>>(`${TRADE_EXECUTOR_URL}/execute/swap`, {
      method: "POST",
      body: JSON.stringify(tradeReq),
    });

    if (!result.success || !result.data) {
      errorExit(result.error || "Trade execution failed");
    }

    if (!jsonMode) {
      const d = result.data;
      console.log(`\nTrade Executed:\n`);
      console.log(`  Trade ID: ${d.id}`);
      console.log(`  Status:   ${d.status}`);
      console.log(`  In:       ${d.amountIn} ${d.tokenIn}`);
      console.log(`  Out:      ${d.amountOut} ${d.tokenOut}`);
      console.log(`  TX Hash:  ${d.txHash}\n`);
    } else {
      output(result.data, true);
    }
  });

// ── portfolio ───────────────────────────────────────────────────────────────

program
  .command("portfolio")
  .description("View current portfolio state")
  .action(async () => {
    const jsonMode = program.opts().json;
    const result = await fetchAPI<Record<string, unknown>>(`${BASE_URL}/portfolio`);

    if (!result.success || !result.data) {
      errorExit(result.error || "Cannot fetch portfolio");
    }

    if (!jsonMode) {
      const d = result.data;
      console.log(`\nPortfolio State:\n`);
      console.log(`  Total Value:    $${d.totalValue}`);
      console.log(`  Positions:      ${(d.positions as unknown[]).length}`);
      console.log(`  Recent Trades:  ${(d.recentTrades as unknown[]).length}`);
      console.log(`  Recent Payments: ${(d.recentPayments as unknown[]).length}`);
      console.log(`  Agents Online:  ${(d.agentStatuses as unknown[]).length}\n`);
    } else {
      output(result.data, true);
    }
  });

// ── agents ──────────────────────────────────────────────────────────────────

program
  .command("agents")
  .description("List registered agents and their status")
  .action(async () => {
    const jsonMode = program.opts().json;
    const result = await fetchAPI<Array<Record<string, unknown>>>(`${BASE_URL}/agents`);

    if (!result.success || !result.data) {
      errorExit(result.error || "Cannot fetch agents");
    }

    if (!jsonMode) {
      console.log(`\nRegistered Agents (${result.data.length}):\n`);
      for (const agent of result.data) {
        const status = agent.isOnline ? "ONLINE" : "OFFLINE";
        console.log(`  [${status}] ${agent.name} (${agent.role})`);
        console.log(`    Address:  ${agent.address}`);
        console.log(`    Balance:  ${agent.walletBalance}`);
        console.log(`    Earnings: ${agent.totalEarnings}\n`);
      }
    } else {
      output(result.data, true);
    }
  });

// ── orchestrate ─────────────────────────────────────────────────────────────

program
  .command("orchestrate")
  .description("Run ReAct orchestration cycle")
  .option("--start", "Start continuous orchestration")
  .option("--stop", "Stop continuous orchestration")
  .option("-s, --strategy <strategy>", "Strategy text to use")
  .action(async (opts) => {
    const jsonMode = program.opts().json;

    if (opts.stop) {
      const result = await fetchAPI<Record<string, unknown>>(`${BASE_URL}/orchestrate/stop`, {
        method: "POST",
      });
      output(result.data ?? { status: "stopped" }, jsonMode);
      return;
    }

    if (opts.start) {
      const body = opts.strategy ? { strategy: opts.strategy } : {};
      const result = await fetchAPI<Record<string, unknown>>(`${BASE_URL}/orchestrate/start`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!result.success) errorExit(result.error || "Failed to start");
      output(result.data ?? { status: "started" }, jsonMode);
      return;
    }

    // Single ReAct cycle
    const body = opts.strategy ? { strategy: opts.strategy } : {};
    const result = await fetchAPI<Record<string, unknown>>(`${BASE_URL}/orchestrate/react`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!result.success || !result.data) {
      errorExit(result.error || "ReAct cycle failed");
    }

    if (!jsonMode) {
      const trace = result.data as Record<string, unknown>;
      const steps = trace.steps as Array<Record<string, unknown>>;
      console.log(`\nReAct Cycle Complete (${steps.length} steps):\n`);
      for (const step of steps) {
        console.log(`  Step ${(step.iteration as number) + 1}: ${step.text}`);
        const calls = step.toolCalls as Array<Record<string, unknown>>;
        for (const tc of calls) {
          console.log(`    -> ${tc.name}`);
        }
      }
      console.log(`\nSummary: ${trace.summary}\n`);
    } else {
      output(result.data, true);
    }
  });

// ─── Run ────────────────────────────────────────────────────────────────────

program.parse();
