import express, { Request, Response } from "express";
import cors from "cors";
import {
  x402PaymentMiddleware,
  X402PricingConfig,
  env,
  ApiResponse,
  TradingSignal,
  AgentWallet,
} from "@swarmmind/shared";
import { MarketScanner } from "./services/market-scanner";
import { SignalGenerator } from "./services/signal-generator";
import { ArbitrageDetector } from "./services/arbitrage-detector";

interface ServerDeps {
  readonly wallet: AgentWallet;
  readonly scanner: MarketScanner;
  readonly signalGenerator: SignalGenerator;
  readonly arbitrageDetector: ArbitrageDetector;
}

const startTime = Date.now();

export function createServer(deps: ServerDeps): express.Application {
  const { wallet, scanner, signalGenerator, arbitrageDetector } = deps;

  const app = express();
  app.use(cors());
  app.use(express.json());

  const latestSignalsPayment = createPricingConfig(wallet.address, "0.001", "Latest trading signals");
  const arbitragePayment = createPricingConfig(wallet.address, "0.005", "Arbitrage signal detection");

  // --- Free endpoints ---

  app.get("/health", (_req: Request, res: Response) => {
    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status: "healthy" },
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  app.get("/status", async (_req: Request, res: Response) => {
    try {
      const balance = await wallet.getBalance();
      const response: ApiResponse<object> = {
        success: true,
        data: {
          agent: "alpha-scout",
          address: wallet.address,
          walletBalance: balance,
          signalCount: signalGenerator.getSignalCount(),
          scannerRunning: scanner.isRunning(),
          uptime: Math.floor((Date.now() - startTime) / 1000),
        },
        error: null,
        timestamp: Date.now(),
      };
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: message,
        timestamp: Date.now(),
      };
      res.status(500).json(response);
    }
  });

  // --- x402-gated endpoints ---

  app.get(
    "/signals/latest",
    x402PaymentMiddleware(latestSignalsPayment),
    async (_req: Request, res: Response) => {
      try {
        const prices = scanner.getLatestPrices();
        await signalGenerator.analyzeMarket(prices);
        const signals = signalGenerator.getLatestSignals(10);

        const response: ApiResponse<readonly TradingSignal[]> = {
          success: true,
          data: signals,
          error: null,
          timestamp: Date.now(),
        };
        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
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

  app.get(
    "/signals/arbitrage",
    x402PaymentMiddleware(arbitragePayment),
    async (_req: Request, res: Response) => {
      try {
        const prices = scanner.getLatestPrices();
        const signals = arbitrageDetector.detect(prices);

        const response: ApiResponse<readonly TradingSignal[]> = {
          success: true,
          data: signals,
          error: null,
          timestamp: Date.now(),
        };
        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
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

function createPricingConfig(
  receiverAddress: string,
  amount: string,
  description: string,
): X402PricingConfig {
  return {
    network: `eip155:${env.xlayer.chainId}`,
    currency: env.contracts.usdc,
    amount,
    receiverAddress,
    facilitatorUrl: env.x402.facilitatorUrl,
    description,
  };
}
