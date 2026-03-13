import { describe, it, expect, vi, beforeEach } from "vitest";
import { TradeApiClient } from "../okx/trade-api";
import type { OkxAuthConfig } from "../okx/auth";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const AUTH_CONFIG: OkxAuthConfig = {
  apiKey: "key",
  secretKey: "secret",
  passphrase: "pass",
  projectId: "proj",
};

function okxResponse(data: object[], code = "0", msg = ""): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ code, msg, data }),
  } as unknown as Response;
}

describe("TradeApiClient", () => {
  let client: TradeApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new TradeApiClient({
      authConfig: AUTH_CONFIG,
      walletAddress: "0xWallet123",
    });
  });

  describe("constructor", () => {
    it("defaults chainId to 196", () => {
      const c = new TradeApiClient({
        authConfig: AUTH_CONFIG,
        walletAddress: "0x1",
      });
      // Verified via getQuote URL param
      mockFetch.mockResolvedValueOnce(
        okxResponse([{
          routerResult: { toTokenAmount: "100", estimateGasFee: "0.001" },
          tx: { to: "0x", data: "0x", value: "0", gasLimit: "21000" },
        }]),
      );
      c.getQuote("0xa", "0xb", "1000");
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("chainIndex=196");
    });

    it("uses custom chainId when provided", () => {
      const c = new TradeApiClient({
        authConfig: AUTH_CONFIG,
        walletAddress: "0x1",
        chainId: "195",
      });
      mockFetch.mockResolvedValueOnce(
        okxResponse([{
          routerResult: { toTokenAmount: "100", estimateGasFee: "0.001" },
          tx: { to: "0x", data: "0x", value: "0", gasLimit: "21000" },
        }]),
      );
      c.getQuote("0xa", "0xb", "1000");
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("chainIndex=195");
    });
  });

  describe("getQuote", () => {
    const mockQuote = {
      routerResult: { toTokenAmount: "500", estimateGasFee: "0.0001" },
      tx: { to: "0xRouter", data: "0xSwapData", value: "0", gasLimit: "150000" },
    };

    it("returns swap quote from DEX aggregator", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([mockQuote]));

      const result = await client.getQuote("0xUSDC", "0xOKB", "1000000");

      expect(result.routerResult.toTokenAmount).toBe("500");
      expect(result.tx.to).toBe("0xRouter");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/aggregator/quote");
      expect(url).toContain("fromTokenAddress=0xUSDC");
      expect(url).toContain("toTokenAddress=0xOKB");
      expect(url).toContain("amount=1000000");
      expect(url).toContain("slippage=0.5");
      expect(url).toContain("userWalletAddress=0xWallet123");
    });

    it("uses custom slippage", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([mockQuote]));

      await client.getQuote("0xa", "0xb", "100", "1.0");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("slippage=1.0");
    });

    it("throws when no quote data returned", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([], "50011", "No liquidity"));

      await expect(client.getQuote("0xa", "0xb", "100")).rejects.toThrow("Quote failed");
    });
  });

  describe("getApproveTransaction", () => {
    it("returns approval tx data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          code: "0",
          data: [{ data: "0xApproveData", to: "0xSpender" }],
        }),
      } as unknown as Response);

      const result = await client.getApproveTransaction("0xUSDC", "1000000");

      expect(result.data).toBe("0xApproveData");
      expect(result.to).toBe("0xSpender");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/aggregator/approve-transaction");
      expect(url).toContain("tokenContractAddress=0xUSDC");
    });

    it("throws when approval fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: "50001", data: [] }),
      } as unknown as Response);

      await expect(client.getApproveTransaction("0x", "100")).rejects.toThrow("Failed to get approve transaction");
    });
  });

  describe("getSwapTransaction", () => {
    it("returns swap tx data for execution", async () => {
      const mockSwap = {
        routerResult: { toTokenAmount: "500", estimateGasFee: "0.0001" },
        tx: { to: "0xRouter", data: "0xSwapCalldata", value: "0", gasLimit: "200000" },
      };
      mockFetch.mockResolvedValueOnce(okxResponse([mockSwap]));

      const result = await client.getSwapTransaction("0xUSDC", "0xOKB", "1000000");

      expect(result.tx.data).toBe("0xSwapCalldata");
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/aggregator/swap");
    });
  });
});
