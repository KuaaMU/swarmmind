import express, { type Request, type Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import type { WsMessage, ApiResponse } from "@swarmmind/shared";
import { Orchestrator } from "./services/orchestrator";
import { IntentParser } from "./services/intent-parser";
import { PortfolioStateManager } from "./services/portfolio-state";

interface ServerDeps {
  readonly port: number;
  readonly orchestrator: Orchestrator;
  readonly intentParser: IntentParser;
  readonly state: PortfolioStateManager;
}

export function createServer(deps: ServerDeps): {
  start: () => void;
  stop: () => void;
} {
  const { port, orchestrator, intentParser, state } = deps;
  const app = express();

  app.use(cors());
  app.use(express.json());

  // --- REST Endpoints ---

  app.get("/health", (_req: Request, res: Response) => {
    const response: ApiResponse<{ status: string; running: boolean }> = {
      success: true,
      data: { status: "healthy", running: orchestrator.isRunning() },
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  app.post("/strategy", async (req: Request, res: Response) => {
    try {
      const { strategy } = req.body as { strategy?: string };
      if (!strategy || typeof strategy !== "string") {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: "Request body must include a 'strategy' string field",
          timestamp: Date.now(),
        };
        res.status(400).json(response);
        return;
      }

      const parsed = await intentParser.parseStrategy(strategy);
      orchestrator.setStrategy(parsed);

      const response: ApiResponse<typeof parsed> = {
        success: true,
        data: parsed,
        error: null,
        timestamp: Date.now(),
      };
      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Server] POST /strategy error:", message);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Failed to parse strategy: ${message}`,
        timestamp: Date.now(),
      };
      res.status(500).json(response);
    }
  });

  app.get("/portfolio", (_req: Request, res: Response) => {
    const response: ApiResponse<ReturnType<PortfolioStateManager["getState"]>> = {
      success: true,
      data: state.getState(),
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  app.get("/agents", (_req: Request, res: Response) => {
    const portfolio = state.getState();
    const response: ApiResponse<typeof portfolio.agentStatuses> = {
      success: true,
      data: portfolio.agentStatuses,
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  app.post("/orchestrate/start", async (req: Request, res: Response) => {
    try {
      if (orchestrator.isRunning()) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: "Orchestrator is already running",
          timestamp: Date.now(),
        };
        res.status(409).json(response);
        return;
      }

      let strategy = orchestrator.getStrategy();
      if (!strategy) {
        const { strategy: text } = req.body as { strategy?: string };
        if (text && typeof text === "string") {
          strategy = await intentParser.parseStrategy(text);
        } else {
          const response: ApiResponse<null> = {
            success: false,
            data: null,
            error: "No strategy set. POST /strategy first or include 'strategy' in body",
            timestamp: Date.now(),
          };
          res.status(400).json(response);
          return;
        }
      }

      orchestrator.start(strategy);

      const response: ApiResponse<{ status: string }> = {
        success: true,
        data: { status: "started" },
        error: null,
        timestamp: Date.now(),
      };
      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Server] POST /orchestrate/start error:", message);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Failed to start: ${message}`,
        timestamp: Date.now(),
      };
      res.status(500).json(response);
    }
  });

  app.post("/orchestrate/stop", (_req: Request, res: Response) => {
    orchestrator.stop();
    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status: "stopped" },
      error: null,
      timestamp: Date.now(),
    };
    res.json(response);
  });

  app.post("/orchestrate/once", async (_req: Request, res: Response) => {
    try {
      if (!orchestrator.getStrategy()) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: "No strategy set. POST /strategy first",
          timestamp: Date.now(),
        };
        res.status(400).json(response);
        return;
      }

      await orchestrator.runOnce();

      const response: ApiResponse<ReturnType<PortfolioStateManager["getState"]>> = {
        success: true,
        data: state.getState(),
        error: null,
        timestamp: Date.now(),
      };
      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Server] POST /orchestrate/once error:", message);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: `Cycle failed: ${message}`,
        timestamp: Date.now(),
      };
      res.status(500).json(response);
    }
  });

  // --- HTTP + WebSocket Server ---

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err);
      clients.delete(ws);
    });
  });

  // Forward orchestrator events to all WebSocket clients
  orchestrator.on("ws", (message: WsMessage) => {
    const payload = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  });

  function start(): void {
    server.listen(port, () => {
      console.log(`[Server] Portfolio Manager running on http://localhost:${port}`);
      console.log(`[Server] WebSocket available on ws://localhost:${port}`);
    });
  }

  function stop(): void {
    orchestrator.stop();
    for (const ws of clients) {
      ws.close();
    }
    clients.clear();
    wss.close();
    server.close(() => {
      console.log("[Server] Shut down");
    });
  }

  return { start, stop };
}
