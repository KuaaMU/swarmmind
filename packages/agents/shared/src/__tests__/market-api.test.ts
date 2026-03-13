import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketApiClient } from "../okx/market-api";
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
    text: () => Promise.resolve(JSON.stringify({ code, msg, data })),
  } as unknown as Response;
}

describe("MarketApiClient", () => {
  let client: MarketApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new MarketApiClient(AUTH_CONFIG);
  });

  describe("getTokenPrices", () => {
    it("fetches prices for given token addresses", async () => {
      const tokens = [
        { chainIndex: "196", tokenAddress: "0xabc", tokenSymbol: "OKB", price: "52.3", volume24h: "1000000", change24h: "2.5" },
      ];
      mockFetch.mockResolvedValueOnce(okxResponse(tokens));

      const result = await client.getTokenPrices(["0xabc"]);

      expect(result).toEqual(tokens);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/market/prices");
      expect(url).toContain("chainIndex=196");
      expect(url).toContain("tokenAddresses=0xabc");
    });

    it("joins multiple token addresses with comma", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([]));

      await client.getTokenPrices(["0xabc", "0xdef"]);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("tokenAddresses=0xabc%2C0xdef");
    });

    it("throws on non-zero error code", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([], "50001", "Rate limit"));

      await expect(client.getTokenPrices(["0x1"])).rejects.toThrow("OKX Market API error: Rate limit");
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(client.getTokenPrices(["0x1"])).rejects.toThrow("OKX API error: 500");
    });
  });

  describe("getSupportedTokens", () => {
    it("fetches all supported tokens on chain 196", async () => {
      const tokens = [
        { chainIndex: "196", tokenAddress: "0x1", tokenSymbol: "WETH", price: "3500", volume24h: "500000", change24h: "-1.2" },
      ];
      mockFetch.mockResolvedValueOnce(okxResponse(tokens));

      const result = await client.getSupportedTokens();

      expect(result).toEqual(tokens);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/aggregator/all-tokens");
      expect(url).toContain("chainIndex=196");
    });
  });

  describe("getCandles", () => {
    it("fetches candlestick data with default period", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([{ data: "candle" }]));

      await client.getCandles("0xabc");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v5/dex/market/candles");
      expect(url).toContain("tokenAddress=0xabc");
      expect(url).toContain("period=1H");
    });

    it("accepts custom period", async () => {
      mockFetch.mockResolvedValueOnce(okxResponse([]));

      await client.getCandles("0xabc", "4H");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("period=4H");
    });
  });
});
