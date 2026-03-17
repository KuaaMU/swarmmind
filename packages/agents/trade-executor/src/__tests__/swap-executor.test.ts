import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwapExecutor, SwapRequest } from "../services/swap-executor";
import type { TradeApiClient, AgentWallet } from "@swarmmind/shared";

function createMockTradeApi(): TradeApiClient {
  return {
    getSwapTransaction: vi.fn().mockResolvedValue({
      tx: {
        to: "0xRouterAddress",
        data: "0xcalldata",
        value: "0",
        gasLimit: "300000",
      },
      routerResult: {
        toTokenAmount: "0.4800",
      },
    }),
    getApproveTransaction: vi.fn().mockResolvedValue({
      to: "0xTokenAddress",
      data: "0xapprovedata",
    }),
    getQuote: vi.fn(),
  } as unknown as TradeApiClient;
}

function createMockWallet(): AgentWallet {
  const mockReceipt = { status: 1, gasUsed: BigInt(150000) };
  const mockTx = {
    hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    wait: vi.fn().mockResolvedValue(mockReceipt),
  };

  return {
    getSigner: vi.fn().mockReturnValue({
      sendTransaction: vi.fn().mockResolvedValue(mockTx),
    }),
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
    getBalance: vi.fn().mockResolvedValue("1.5"),
    provider: {},
  } as unknown as AgentWallet;
}

describe("SwapExecutor", () => {
  let executor: SwapExecutor;
  let mockTradeApi: TradeApiClient;
  let mockWallet: AgentWallet;

  beforeEach(() => {
    mockTradeApi = createMockTradeApi();
    mockWallet = createMockWallet();
    executor = new SwapExecutor(mockTradeApi, mockWallet);
  });

  describe("executeSwap", () => {
    it("executes a swap with known token symbols", async () => {
      const request: SwapRequest = {
        tokenIn: "USDC",
        tokenOut: "WETH",
        amountIn: "100",
        signalId: "sig-001",
      };

      const result = await executor.executeSwap(request);

      expect(result.status).toBe("COMPLETED");
      expect(result.signalId).toBe("sig-001");
      expect(result.amountIn).toBe("100");
      expect(result.amountOut).toBe("0.4800");
      expect(result.txHash).toBeTruthy();
      expect(result.id).toBeTruthy();
    });

    it("handles native OKB token without approval", async () => {
      const request: SwapRequest = {
        tokenIn: "OKB",
        tokenOut: "USDC",
        amountIn: "1",
      };

      await executor.executeSwap(request);

      // OKB is native, should NOT call getApproveTransaction
      expect(mockTradeApi.getApproveTransaction).not.toHaveBeenCalled();
      expect(mockTradeApi.getSwapTransaction).toHaveBeenCalled();
    });

    it("requests approval for ERC20 tokens", async () => {
      const request: SwapRequest = {
        tokenIn: "USDC",
        tokenOut: "WETH",
        amountIn: "50",
      };

      await executor.executeSwap(request);

      expect(mockTradeApi.getApproveTransaction).toHaveBeenCalled();
    });

    it("uses default slippage of 0.5 when not provided", async () => {
      const request: SwapRequest = {
        tokenIn: "USDC",
        tokenOut: "WETH",
        amountIn: "50",
      };

      await executor.executeSwap(request);

      expect(mockTradeApi.getSwapTransaction).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "50",
        "0.5",
      );
    });

    it("uses custom slippage when provided", async () => {
      const request: SwapRequest = {
        tokenIn: "USDC",
        tokenOut: "WETH",
        amountIn: "50",
        slippage: "1.0",
      };

      await executor.executeSwap(request);

      expect(mockTradeApi.getSwapTransaction).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "50",
        "1.0",
      );
    });

    it("handles raw hex addresses", async () => {
      const request: SwapRequest = {
        tokenIn: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
        tokenOut: "0x5A77f1443D16ee5761d310e38b7308aaF2d232EE",
        amountIn: "100",
      };

      const result = await executor.executeSwap(request);

      expect(result.status).toBe("COMPLETED");
      expect(result.tokenIn).toBe("0x74b7F16337b8972027F6196A17a631aC6dE26d22");
    });

    it("throws on unknown token symbol", async () => {
      const request: SwapRequest = {
        tokenIn: "UNKNOWN_TOKEN",
        tokenOut: "USDC",
        amountIn: "100",
      };

      await expect(executor.executeSwap(request)).rejects.toThrow(
        "Unknown token symbol: UNKNOWN_TOKEN",
      );
    });

    it("records failed trade when swap transaction fails", async () => {
      const failedReceipt = { status: 0, gasUsed: BigInt(100000) };
      const failedTx = {
        hash: "0xfailed",
        wait: vi.fn().mockResolvedValue(failedReceipt),
      };
      (mockWallet.getSigner as ReturnType<typeof vi.fn>).mockReturnValue({
        sendTransaction: vi.fn().mockResolvedValue(failedTx),
      });

      const result = await executor.executeSwap({
        tokenIn: "OKB",
        tokenOut: "USDC",
        amountIn: "1",
      });

      expect(result.status).toBe("FAILED");
      expect(executor.getRecentTrades()).toHaveLength(1);
    });

    it("throws and records failed trade on exception", async () => {
      (mockWallet.getSigner as ReturnType<typeof vi.fn>).mockReturnValue({
        sendTransaction: vi.fn().mockRejectedValue(new Error("insufficient funds")),
      });

      await expect(
        executor.executeSwap({ tokenIn: "OKB", tokenOut: "USDC", amountIn: "1" }),
      ).rejects.toThrow("Swap execution failed: insufficient funds");

      const trades = executor.getRecentTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].status).toBe("FAILED");
    });
  });

  describe("getRecentTrades", () => {
    it("returns empty array initially", () => {
      expect(executor.getRecentTrades()).toEqual([]);
    });

    it("returns trades after execution", async () => {
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "USDC", amountIn: "1" });
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "WETH", amountIn: "2" });

      const trades = executor.getRecentTrades();
      expect(trades).toHaveLength(2);
    });

    it("respects the limit parameter", async () => {
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "USDC", amountIn: "1" });
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "WETH", amountIn: "2" });
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "USDT", amountIn: "3" });

      expect(executor.getRecentTrades(2)).toHaveLength(2);
    });

    it("stores most recent trades first", async () => {
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "USDC", amountIn: "1" });
      await executor.executeSwap({ tokenIn: "OKB", tokenOut: "WETH", amountIn: "2" });

      const trades = executor.getRecentTrades();
      expect(trades[0].amountIn).toBe("2");
    });
  });
});
