import { v4 as uuid } from "uuid";
import { ethers } from "ethers";
import {
  TradeApiClient,
  AgentWallet,
  TradeExecution,
  TOKEN_ADDRESSES,
} from "@swarmmind/shared";

/** Native token sentinel address used by OKX DEX aggregator */
const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export interface SwapRequest {
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly amountIn: string;
  readonly slippage?: string;
  readonly signalId?: string;
}

function isNativeToken(address: string): boolean {
  return (
    address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    address.toUpperCase() === "OKB"
  );
}

function resolveTokenAddress(token: string): string {
  if (token.startsWith("0x")) {
    return token;
  }
  const upper = token.toUpperCase();
  if (upper === "OKB") {
    return NATIVE_TOKEN_ADDRESS;
  }
  const addresses = TOKEN_ADDRESSES[196];
  const mapped = (addresses as Record<string, string>)[upper];
  if (!mapped) {
    throw new Error(`Unknown token symbol: ${token}`);
  }
  return mapped;
}

export class SwapExecutor {
  private readonly tradeApi: TradeApiClient;
  private readonly agentWallet: AgentWallet;
  private readonly recentTrades: TradeExecution[] = [];
  private static readonly MAX_RECENT = 50;

  constructor(tradeApi: TradeApiClient, agentWallet: AgentWallet) {
    this.tradeApi = tradeApi;
    this.agentWallet = agentWallet;
  }

  async executeSwap(request: SwapRequest): Promise<TradeExecution> {
    const tokenInAddr = resolveTokenAddress(request.tokenIn);
    const tokenOutAddr = resolveTokenAddress(request.tokenOut);
    const slippage = request.slippage ?? "0.5";

    const tradeId = uuid();
    const pendingTrade: TradeExecution = {
      id: tradeId,
      signalId: request.signalId ?? "",
      tokenIn: tokenInAddr,
      tokenOut: tokenOutAddr,
      amountIn: request.amountIn,
      amountOut: "0",
      txHash: "",
      status: "EXECUTING",
      timestamp: Date.now(),
    };

    try {
      // Step 1: handle ERC20 approval when token is not native
      if (!isNativeToken(tokenInAddr)) {
        await this.handleApproval(tokenInAddr, request.amountIn);
      }

      // Step 2: get swap transaction data from OKX aggregator
      const swapData = await this.tradeApi.getSwapTransaction(
        tokenInAddr,
        tokenOutAddr,
        request.amountIn,
        slippage,
      );

      // Step 3: send the swap transaction
      const signer = this.agentWallet.getSigner();
      const tx = await signer.sendTransaction({
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: BigInt(swapData.tx.value),
        gasLimit: BigInt(swapData.tx.gasLimit),
      });

      const receipt = await tx.wait();
      const succeeded = receipt !== null && receipt.status === 1;

      const completedTrade: TradeExecution = {
        ...pendingTrade,
        amountOut: swapData.routerResult.toTokenAmount,
        txHash: tx.hash,
        status: succeeded ? "COMPLETED" : "FAILED",
        gasUsed: receipt?.gasUsed?.toString() ?? "0",
      };

      this.addTrade(completedTrade);
      return completedTrade;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const failedTrade: TradeExecution = {
        ...pendingTrade,
        status: "FAILED",
        txHash: "",
      };
      this.addTrade(failedTrade);
      throw new Error(`Swap execution failed: ${message}`);
    }
  }

  getRecentTrades(limit: number = 20): readonly TradeExecution[] {
    return this.recentTrades.slice(0, limit);
  }

  private async handleApproval(tokenAddress: string, amount: string): Promise<void> {
    const approveData = await this.tradeApi.getApproveTransaction(tokenAddress, amount);
    const signer = this.agentWallet.getSigner();

    const approveTx = await signer.sendTransaction({
      to: approveData.to,
      data: approveData.data,
    });

    const receipt = await approveTx.wait();
    if (receipt === null || receipt.status !== 1) {
      throw new Error("Token approval transaction failed");
    }
  }

  private addTrade(trade: TradeExecution): void {
    this.recentTrades.unshift(trade);
    if (this.recentTrades.length > SwapExecutor.MAX_RECENT) {
      this.recentTrades.length = SwapExecutor.MAX_RECENT;
    }
  }
}
