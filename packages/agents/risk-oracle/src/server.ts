import express from "express";
import cors from "cors";
import {
  env,
  x402PaymentMiddleware,
  type X402PricingConfig,
  type TradingSignal,
  type ApiResponse,
  type RiskAssessment,
} from "@swarmmind/shared";
import type { RiskEvaluator } from "./services/risk-evaluator";
import type { VolatilityCalculator, VolatilityMetrics } from "./services/volatility-calculator";

const PORT = env.ports.riskOracle;
const NETWORK = "eip155:196";

interface ServerDeps {
  readonly riskEvaluator: RiskEvaluator;
  readonly volatilityCalc: VolatilityCalculator;
  readonly walletAddress: string;
}

export function createServer(deps: ServerDeps): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const tradeAssessConfig: X402PricingConfig = {
    network: NETWORK,
    currency: "USDC",
    amount: "0.002",
    receiverAddress: deps.walletAddress,
    facilitatorUrl: env.x402.facilitatorUrl,
    description: "Risk Oracle - Trade Assessment",
  };

  const volatilityConfig: X402PricingConfig = {
    network: NETWORK,
    currency: "USDC",
    amount: "0.001",
    receiverAddress: deps.walletAddress,
    facilitatorUrl: env.x402.facilitatorUrl,
    description: "Risk Oracle - Volatility Metrics",
  };

  // --- Free endpoints ---

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", agent: "risk-oracle", timestamp: Date.now() });
  });

  app.get("/status", (_req, res) => {
    const response: ApiResponse<object> = {
      success: true,
      data: {
        agent: "risk-oracle",
        role: "ORACLE",
        address: deps.walletAddress,
        port: PORT,
        assessmentsCached: deps.riskEvaluator.getAssessmentCount(),
        trackedTokens: deps.volatilityCalc.getTrackedTokens(),
        uptime: process.uptime(),
      },
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  // --- x402-gated endpoints ---

  app.post(
    "/assess/trade",
    x402PaymentMiddleware(tradeAssessConfig),
    async (req, res) => {
      try {
        const signal = validateTradingSignal(req.body);
        const assessment = await deps.riskEvaluator.assessTrade(signal);

        const response: ApiResponse<RiskAssessment> = {
          success: true,
          data: assessment,
          error: null,
          timestamp: Date.now(),
        };
        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Assessment failed";
        console.error("Trade assessment error:", message);

        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: message,
          timestamp: Date.now(),
        };
        res.status(400).json(response);
      }
    },
  );

  app.get(
    "/metrics/volatility/:token",
    x402PaymentMiddleware(volatilityConfig),
    (req, res) => {
      try {
        const token = req.params.token as string;
        if (!token || token.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            data: null,
            error: "Token parameter is required",
            timestamp: Date.now(),
          };
          res.status(400).json(response);
          return;
        }

        const metrics = deps.volatilityCalc.getMetrics(token as string);
        const response: ApiResponse<VolatilityMetrics> = {
          success: true,
          data: metrics,
          error: null,
          timestamp: Date.now(),
        };
        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Metrics retrieval failed";
        console.error("Volatility metrics error:", message);

        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: message,
          timestamp: Date.now(),
        };
        res.status(500).json(response);
      }
    },
  );

  return app;
}

export function startServer(app: express.Application): ReturnType<express.Application["listen"]> {
  return app.listen(PORT, () => {
    console.log(`Risk Oracle agent listening on port ${PORT}`);
  });
}

function validateTradingSignal(body: unknown): TradingSignal {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a TradingSignal object");
  }

  const obj = body as Record<string, unknown>;

  const requiredFields = [
    "id", "type", "tokenPair", "direction", "confidence",
    "entryPrice", "targetPrice", "stopLoss", "rationale", "timestamp", "source",
  ];

  const missing = requiredFields.filter((f) => obj[f] === undefined || obj[f] === null);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const validTypes = ["ARBITRAGE", "MOMENTUM", "MEAN_REVERSION"];
  if (!validTypes.includes(obj.type as string)) {
    throw new Error(`Invalid signal type: ${obj.type}. Must be one of: ${validTypes.join(", ")}`);
  }

  const validDirections = ["BUY", "SELL"];
  if (!validDirections.includes(obj.direction as string)) {
    throw new Error(`Invalid direction: ${obj.direction}. Must be BUY or SELL`);
  }

  const confidence = obj.confidence as number;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error("Confidence must be a number between 0 and 1");
  }

  return body as TradingSignal;
}
