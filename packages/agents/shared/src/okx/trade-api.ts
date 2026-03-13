import { createOkxAuthHeaders, OkxAuthConfig } from "./auth";

const OKX_BASE_URL = "https://web3.okx.com";

export interface SwapQuote {
  readonly routerResult: {
    readonly toTokenAmount: string;
    readonly estimateGasFee: string;
  };
  readonly tx: {
    readonly to: string;
    readonly data: string;
    readonly value: string;
    readonly gasLimit: string;
  };
}

export interface ApproveData {
  readonly data: string;
  readonly to: string;
}

export interface SwapResult {
  readonly code: string;
  readonly msg: string;
  readonly data: readonly SwapQuote[];
}

export interface TradeApiConfig {
  readonly authConfig: OkxAuthConfig;
  readonly walletAddress: string;
  readonly chainId?: string;
}

export class TradeApiClient {
  private readonly authConfig: OkxAuthConfig;
  private readonly walletAddress: string;
  private readonly chainId: string;

  constructor(config: TradeApiConfig) {
    this.authConfig = config.authConfig;
    this.walletAddress = config.walletAddress;
    this.chainId = config.chainId || "196";
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
      throw new Error(`OKX Trade API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get a swap quote from the DEX aggregator
   */
  async getQuote(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    slippage: string = "0.5"
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      chainIndex: this.chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage,
      userWalletAddress: this.walletAddress,
    });

    const path = `/api/v5/dex/aggregator/quote?${params}`;
    const result = await this.request<SwapResult>("GET", path);

    if (result.code !== "0" || result.data.length === 0) {
      throw new Error(`Quote failed: ${result.msg}`);
    }

    return result.data[0];
  }

  /**
   * Get approval transaction data for token spending
   */
  async getApproveTransaction(
    tokenAddress: string,
    amount: string
  ): Promise<ApproveData> {
    const params = new URLSearchParams({
      chainIndex: this.chainId,
      tokenContractAddress: tokenAddress,
      approveAmount: amount,
    });

    const path = `/api/v5/dex/aggregator/approve-transaction?${params}`;
    const result = await this.request<{ code: string; data: readonly ApproveData[] }>("GET", path);

    if (result.code !== "0" || result.data.length === 0) {
      throw new Error("Failed to get approve transaction");
    }

    return result.data[0];
  }

  /**
   * Get the swap transaction data for execution
   */
  async getSwapTransaction(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    slippage: string = "0.5"
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      chainIndex: this.chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage,
      userWalletAddress: this.walletAddress,
    });

    const path = `/api/v5/dex/aggregator/swap?${params}`;
    const result = await this.request<SwapResult>("GET", path);

    if (result.code !== "0" || result.data.length === 0) {
      throw new Error(`Swap failed: ${result.msg}`);
    }

    return result.data[0];
  }
}
