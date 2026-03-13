import {
  env,
  AgentWallet,
  TradeApiClient,
} from "@swarmmind/shared";
import type { OkxAuthConfig } from "@swarmmind/shared";
import { SwapExecutor } from "./services/swap-executor";
import { TxMonitor } from "./services/tx-monitor";
import { startServer } from "./server";

function getPrivateKey(): string {
  const key = process.env.TRADE_EXECUTOR_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "Missing TRADE_EXECUTOR_PRIVATE_KEY environment variable. " +
      "Set it to the executor wallet's private key.",
    );
  }
  return key;
}

function main(): void {
  const privateKey = getPrivateKey();

  // Create agent wallet connected to X Layer
  const agentWallet = AgentWallet.create({
    privateKey,
    chainId: env.xlayer.chainId,
    rpcUrl: env.xlayer.rpcUrl,
  });

  // Build OKX auth config for the Trade API
  const authConfig: OkxAuthConfig = {
    apiKey: env.okx.apiKey,
    secretKey: env.okx.secretKey,
    passphrase: env.okx.passphrase,
    projectId: env.okx.projectId,
  };

  // Create trade API client
  const tradeApi = new TradeApiClient({
    authConfig,
    walletAddress: agentWallet.address,
    chainId: String(env.xlayer.chainId),
  });

  // Create services
  const swapExecutor = new SwapExecutor(tradeApi, agentWallet);
  const txMonitor = new TxMonitor(agentWallet.provider);

  // Start server
  const port = env.ports.tradeExecutor;
  const server = startServer({ swapExecutor, txMonitor, agentWallet, port });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("\n[TradeExecutor] Shutting down...");
    txMonitor.dispose();
    server.close(() => {
      console.log("[TradeExecutor] Server closed.");
      process.exit(0);
    });

    // Force exit after 5 seconds if server hasn't closed
    setTimeout(() => {
      console.error("[TradeExecutor] Forced shutdown after timeout.");
      process.exit(1);
    }, 5_000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`[TradeExecutor] Agent initialized`);
  console.log(`[TradeExecutor] Wallet: ${agentWallet.address}`);
  console.log(`[TradeExecutor] Chain: X Layer (${env.xlayer.chainId})`);
}

main();
