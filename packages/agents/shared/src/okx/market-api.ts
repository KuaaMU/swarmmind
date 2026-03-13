import { createOkxAuthHeaders, OkxAuthConfig } from "./auth";

const OKX_BASE_URL = "https://web3.okx.com";

export interface TokenPrice {
  readonly chainIndex: string;
  readonly tokenAddress: string;
  readonly tokenSymbol: string;
  readonly price: string;
  readonly volume24h: string;
  readonly change24h: string;
}

export interface MarketDataResponse {
  readonly code: string;
  readonly msg: string;
  readonly data: readonly TokenPrice[];
}

export class MarketApiClient {
  private readonly authConfig: OkxAuthConfig;

  constructor(authConfig: OkxAuthConfig) {
    this.authConfig = authConfig;
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const headers = createOkxAuthHeaders(this.authConfig, method, path, bodyStr);

    const response = await fetch(`${OKX_BASE_URL}${path}`, {
      method,
      headers: headers as unknown as Record<string, string>,
      body: bodyStr,
    });

    if (!response.ok) {
      throw new Error(`OKX API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get token prices on X Layer (chain index 196)
   */
  async getTokenPrices(tokenAddresses: readonly string[]): Promise<readonly TokenPrice[]> {
    const params = new URLSearchParams({
      chainIndex: "196",
      tokenAddresses: tokenAddresses.join(","),
    });

    const path = `/api/v5/dex/market/prices?${params}`;
    const result = await this.request<MarketDataResponse>("GET", path);

    if (result.code !== "0") {
      throw new Error(`OKX Market API error: ${result.msg}`);
    }

    return result.data;
  }

  /**
   * Get supported tokens on X Layer
   */
  async getSupportedTokens(): Promise<readonly TokenPrice[]> {
    const path = "/api/v5/dex/aggregator/all-tokens?chainIndex=196";
    const result = await this.request<MarketDataResponse>("GET", path);

    if (result.code !== "0") {
      throw new Error(`OKX Token API error: ${result.msg}`);
    }

    return result.data;
  }

  /**
   * Get candlestick / OHLCV data for a token pair
   */
  async getCandles(
    tokenAddress: string,
    period: string = "1H"
  ): Promise<unknown> {
    const params = new URLSearchParams({
      chainIndex: "196",
      tokenAddress,
      period,
    });

    const path = `/api/v5/dex/market/candles?${params}`;
    return this.request("GET", path);
  }
}
