import { AgentWallet, env, ChainId, createAIClientFromEnv } from "@swarmmind/shared";
import { createServer } from "./server";
import { MarketScanner } from "./services/market-scanner";
import { SignalGenerator } from "./services/signal-generator";
import { ArbitrageDetector } from "./services/arbitrage-detector";

function main(): void {
  const privateKey = process.env.ALPHA_SCOUT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Missing ALPHA_SCOUT_PRIVATE_KEY environment variable");
    process.exit(1);
  }

  const chainId = env.xlayer.chainId as ChainId;

  const wallet = AgentWallet.create({ privateKey, chainId });
  console.log("[AlphaScout] Wallet address: %s", wallet.address);

  const ai = createAIClientFromEnv();
  console.log("[AlphaScout] AI provider: %s (%s)", ai.getProvider(), ai.getModel());

  const scanner = new MarketScanner(chainId);
  const signalGenerator = new SignalGenerator(ai);
  const arbitrageDetector = new ArbitrageDetector();

  const app = createServer({ wallet, scanner, signalGenerator, arbitrageDetector });

  const port = env.ports.alphaScout;

  const server = app.listen(port, () => {
    console.log("[AlphaScout] Server listening on port %d", port);
  });

  scanner.start();

  const shutdown = (): void => {
    console.log("[AlphaScout] Shutting down...");
    scanner.stop();
    server.close(() => {
      console.log("[AlphaScout] Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
