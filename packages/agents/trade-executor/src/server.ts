import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ApiResponse, AgentWallet } from "@swarmmind/shared";
import { SwapExecutor, SwapRequest } from "./services/swap-executor";
import { TxMonitor } from "./services/tx-monitor";

const DEFAULT_API_KEY = "swarmmind-internal";

interface ServerDeps {
  readonly swapExecutor: SwapExecutor;
  readonly txMonitor: TxMonitor;
  readonly agentWallet: AgentWallet;
  readonly port: number;
}

function createApiKeyMiddleware(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.headers["x-api-key"] as string | undefined;
    if (provided !== apiKey) {
      const body: ApiResponse<null> = {
        success: false,
        data: null,
        error: "Unauthorized: invalid or missing API key",
        timestamp: Date.now(),
      };
      res.status(401).json(body);
      return;
    }
    next();
  };
}

function respond<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    timestamp: Date.now(),
  };
  res.json(body);
}

function respondError(res: Response, status: number, message: string): void {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: message,
    timestamp: Date.now(),
  };
  res.status(status).json(body);
}

export function createServer(deps: ServerDeps): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const apiKey = process.env.TRADE_EXECUTOR_API_KEY ?? DEFAULT_API_KEY;
  const requireApiKey = createApiKeyMiddleware(apiKey);

  // ---- Free endpoints ----

  app.get("/health", (_req: Request, res: Response) => {
    respond(res, { status: "healthy", timestamp: Date.now() });
  });

  app.get("/status", async (_req: Request, res: Response) => {
    try {
      const balance = await deps.agentWallet.getBalance();
      respond(res, {
        agent: "trade-executor",
        address: deps.agentWallet.address,
        balance,
        pendingTx: deps.txMonitor.getAllPending().length,
        uptime: process.uptime(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      respondError(res, 500, msg);
    }
  });

  // ---- Protected endpoints ----

  app.post("/execute/swap", requireApiKey, async (req: Request, res: Response) => {
    try {
      const { tokenIn, tokenOut, amountIn, slippage } = req.body;

      if (!tokenIn || !tokenOut || !amountIn) {
        respondError(res, 400, "Missing required fields: tokenIn, tokenOut, amountIn");
        return;
      }

      const request: SwapRequest = {
        tokenIn,
        tokenOut,
        amountIn: String(amountIn),
        slippage: slippage ? String(slippage) : undefined,
      };

      const result = await deps.swapExecutor.executeSwap(request);

      // Monitor the transaction if it has a hash
      if (result.txHash) {
        deps.txMonitor.monitor(result.txHash);
      }

      respond(res, result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      respondError(res, 500, msg);
    }
  });

  app.get("/status/:txHash", requireApiKey, (req: Request, res: Response) => {
    const txHash = req.params.txHash as string;
    const record = deps.txMonitor.getStatus(txHash);

    if (!record) {
      respondError(res, 404, `No monitored transaction found for hash: ${txHash}`);
      return;
    }

    respond(res, record);
  });

  app.get("/trades/recent", requireApiKey, (_req: Request, res: Response) => {
    const trades = deps.swapExecutor.getRecentTrades(20);
    respond(res, trades);
  });

  return app;
}

export function startServer(deps: ServerDeps): ReturnType<express.Application["listen"]> {
  const app = createServer(deps);

  return app.listen(deps.port, () => {
    console.log(`[TradeExecutor] Server running on port ${deps.port}`);
    console.log(`[TradeExecutor] Wallet address: ${deps.agentWallet.address}`);
  });
}
