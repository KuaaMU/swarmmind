import { env, AgentWallet, createAIClientFromEnv } from "@swarmmind/shared";
import { IntentParser } from "./services/intent-parser";
import { PortfolioStateManager } from "./services/portfolio-state";
import { Orchestrator } from "./services/orchestrator";
import { ReActOrchestrator } from "./services/react-orchestrator";
import { createAgentTools } from "./tools/agent-tools";
import { createServer } from "./server";

function getPrivateKey(): string {
  const key = process.env["PORTFOLIO_MANAGER_PRIVATE_KEY"];
  if (!key) {
    throw new Error(
      "Missing PORTFOLIO_MANAGER_PRIVATE_KEY environment variable",
    );
  }
  return key;
}

function main(): void {
  console.log("[PortfolioManager] Initializing...");

  // Wallet
  const wallet = AgentWallet.create({
    privateKey: getPrivateKey(),
    chainId: env.xlayer.chainId,
    rpcUrl: env.xlayer.rpcUrl,
  });
  console.log(`[PortfolioManager] Wallet address: ${wallet.address}`);

  // AI Client (supports multiple providers)
  const ai = createAIClientFromEnv();
  console.log(`[PortfolioManager] AI provider: ${ai.getProvider()} (${ai.getModel()})`);

  // Services
  const intentParser = new IntentParser(ai);
  const state = new PortfolioStateManager();
  const orchestrator = new Orchestrator(
    wallet,
    env.x402.facilitatorUrl,
    state,
  );

  // ReAct Orchestrator (tool-use agent loop)
  const tools = createAgentTools({
    alphaScoutUrl: process.env["ALPHA_SCOUT_URL"] || "http://localhost:3001",
    riskOracleUrl: process.env["RISK_ORACLE_URL"] || "http://localhost:3002",
    tradeExecutorUrl: process.env["TRADE_EXECUTOR_URL"] || "http://localhost:3003",
    wallet,
    facilitatorUrl: env.x402.facilitatorUrl,
    state,
  });
  const reactOrchestrator = new ReActOrchestrator(ai, tools, state);
  console.log("[PortfolioManager] ReAct orchestrator initialized with", tools.length, "tools");

  // Server
  const { start, stop } = createServer({
    port: env.ports.portfolioManager,
    orchestrator,
    reactOrchestrator,
    intentParser,
    state,
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("[PortfolioManager] Shutting down...");
    stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  start();
}

main();
