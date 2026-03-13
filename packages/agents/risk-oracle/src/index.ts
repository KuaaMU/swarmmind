import { env, AgentWallet, createAIClientFromEnv } from "@swarmmind/shared";
import { VolatilityCalculator } from "./services/volatility-calculator";
import { RiskEvaluator } from "./services/risk-evaluator";
import { createServer, startServer } from "./server";

function main(): void {
  const privateKey = process.env.RISK_ORACLE_PRIVATE_KEY;
  if (!privateKey) {
    console.error("RISK_ORACLE_PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  const wallet = AgentWallet.create({
    privateKey,
    chainId: env.xlayer.chainId,
    rpcUrl: env.xlayer.rpcUrl,
  });
  console.log(`Risk Oracle wallet: ${wallet.address}`);

  const ai = createAIClientFromEnv();
  console.log(`Risk Oracle AI provider: ${ai.getProvider()} (${ai.getModel()})`);

  const volatilityCalc = new VolatilityCalculator();
  const riskEvaluator = new RiskEvaluator(ai, volatilityCalc);

  const app = createServer({
    riskEvaluator,
    volatilityCalc,
    walletAddress: wallet.address,
  });

  const server = startServer(app);

  const shutdown = (): void => {
    console.log("\nShutting down Risk Oracle...");
    server.close(() => {
      console.log("Risk Oracle stopped");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
