/**
 * SwarmMind MCP Server
 *
 * Exposes SwarmMind agent capabilities as MCP tools and resources,
 * allowing any MCP-compatible client (Claude Code, etc.) to interact
 * with the SwarmMind DeFi agent network.
 *
 * Tools (actions):
 *   - get_signals: Fetch latest trading signals from Alpha Scout
 *   - assess_risk: Assess trade risk via Risk Oracle
 *   - execute_trade: Execute trade via Trade Executor
 *   - get_portfolio: Get current portfolio state
 *   - run_cycle: Run one full ReAct orchestration cycle
 *
 * Resources (readable data):
 *   - swarmmind://agents: List all registered agents
 *   - swarmmind://portfolio: Current portfolio state
 *   - swarmmind://reasoning: Latest ReAct reasoning trace
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ──────────────────────────────────────────────────────────

const PORTFOLIO_MANAGER_URL = process.env["PORTFOLIO_MANAGER_URL"] || "http://localhost:3000";
const ALPHA_SCOUT_URL = process.env["ALPHA_SCOUT_URL"] || "http://localhost:3001";
const RISK_ORACLE_URL = process.env["RISK_ORACLE_URL"] || "http://localhost:3002";
const TRADE_EXECUTOR_URL = process.env["TRADE_EXECUTOR_URL"] || "http://localhost:3003";

// ─── HTTP Helper ────────────────────────────────────────────────────────────

async function fetchJSON(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

// ─── Server Setup ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "swarmmind",
  version: "1.0.0",
});

// ─── Tools ──────────────────────────────────────────────────────────────────

server.tool(
  "get_signals",
  "Fetch latest trading signals from Alpha Scout agent (ARBITRAGE, MOMENTUM, MEAN_REVERSION)",
  {
    signal_type: z.enum(["ARBITRAGE", "MOMENTUM", "MEAN_REVERSION"]).optional()
      .describe("Filter by signal type. Omit for all types."),
  },
  async ({ signal_type }) => {
    try {
      const data = await fetchJSON(`${ALPHA_SCOUT_URL}/signals/latest`);
      const body = data as { success: boolean; data: unknown[] | null };
      let signals = body.data ?? [];

      if (signal_type) {
        signals = (signals as Array<{ type: string }>).filter(
          (s) => s.type === signal_type,
        );
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ count: signals.length, signals }, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching signals: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "assess_risk",
  "Assess trade risk via Risk Oracle agent (returns riskScore 1-10, recommendation)",
  {
    signal: z.object({
      id: z.string().describe("Signal ID"),
      type: z.string().describe("Signal type"),
      tokenPair: z.string().describe("Token pair"),
      direction: z.string().describe("BUY or SELL"),
      confidence: z.number().describe("Confidence 0-1"),
      entryPrice: z.number().describe("Entry price"),
      targetPrice: z.number().describe("Target price"),
      stopLoss: z.number().describe("Stop loss"),
      rationale: z.string().describe("Signal rationale"),
      timestamp: z.number().describe("Signal timestamp"),
      source: z.string().describe("Signal source"),
    }).describe("The trading signal to assess"),
  },
  async ({ signal }) => {
    try {
      const data = await fetchJSON(`${RISK_ORACLE_URL}/assess/trade`, {
        method: "POST",
        body: JSON.stringify(signal),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error assessing risk: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "execute_trade",
  "Execute a trade via Trade Executor agent on X Layer DEX",
  {
    signalId: z.string().describe("Signal ID triggering this trade"),
    tokenPair: z.string().describe("Token pair to trade"),
    direction: z.enum(["BUY", "SELL"]).describe("Trade direction"),
    entryPrice: z.number().describe("Expected entry price"),
    amount: z.string().describe("Amount in USDC"),
  },
  async ({ signalId, tokenPair, direction, entryPrice, amount }) => {
    try {
      const data = await fetchJSON(`${TRADE_EXECUTOR_URL}/execute/swap`, {
        method: "POST",
        body: JSON.stringify({ signalId, tokenPair, direction, entryPrice, amount }),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error executing trade: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_portfolio",
  "Get current portfolio state (positions, recent trades, agent statuses)",
  {},
  async () => {
    try {
      const data = await fetchJSON(`${PORTFOLIO_MANAGER_URL}/portfolio`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error getting portfolio: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "run_cycle",
  "Run one full ReAct orchestration cycle (LLM-driven tool-use loop)",
  {
    strategy: z.string().optional()
      .describe("Optional strategy text. Uses current strategy if omitted."),
  },
  async ({ strategy }) => {
    try {
      const body = strategy ? { strategy } : {};
      const data = await fetchJSON(`${PORTFOLIO_MANAGER_URL}/orchestrate/react`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error running cycle: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

// ─── Resources ──────────────────────────────────────────────────────────────

server.resource(
  "agents",
  "swarmmind://agents",
  { description: "List all registered SwarmMind agents and their status", mimeType: "application/json" },
  async () => {
    try {
      const data = await fetchJSON(`${PORTFOLIO_MANAGER_URL}/agents`);
      return {
        contents: [{
          uri: "swarmmind://agents",
          text: JSON.stringify(data, null, 2),
          mimeType: "application/json",
        }],
      };
    } catch {
      return {
        contents: [{
          uri: "swarmmind://agents",
          text: JSON.stringify({ error: "Cannot reach portfolio manager" }),
          mimeType: "application/json",
        }],
      };
    }
  },
);

server.resource(
  "portfolio",
  "swarmmind://portfolio",
  { description: "Current portfolio state", mimeType: "application/json" },
  async () => {
    try {
      const data = await fetchJSON(`${PORTFOLIO_MANAGER_URL}/portfolio`);
      return {
        contents: [{
          uri: "swarmmind://portfolio",
          text: JSON.stringify(data, null, 2),
          mimeType: "application/json",
        }],
      };
    } catch {
      return {
        contents: [{
          uri: "swarmmind://portfolio",
          text: JSON.stringify({ error: "Cannot reach portfolio manager" }),
          mimeType: "application/json",
        }],
      };
    }
  },
);

server.resource(
  "reasoning",
  "swarmmind://reasoning",
  { description: "Latest ReAct reasoning trace", mimeType: "application/json" },
  async () => {
    try {
      const data = await fetchJSON(`${PORTFOLIO_MANAGER_URL}/reasoning/latest`);
      return {
        contents: [{
          uri: "swarmmind://reasoning",
          text: JSON.stringify(data, null, 2),
          mimeType: "application/json",
        }],
      };
    } catch {
      return {
        contents: [{
          uri: "swarmmind://reasoning",
          text: JSON.stringify({ error: "Cannot reach portfolio manager" }),
          mimeType: "application/json",
        }],
      };
    }
  },
);

// ─── Start ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SwarmMind MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
