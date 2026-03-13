import { ethers } from "ethers";

export type TxStatus = "PENDING" | "CONFIRMED" | "FAILED";

export interface TxRecord {
  readonly txHash: string;
  readonly status: TxStatus;
  readonly blockNumber: number | null;
  readonly gasUsed: string | null;
  readonly timestamp: number;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s intervals

export class TxMonitor {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly transactions: Map<string, TxRecord> = new Map();
  private readonly activePollers: Map<string, NodeJS.Timeout> = new Map();

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
  }

  /**
   * Start monitoring a transaction by hash.
   * Polls for a receipt every 2 seconds until confirmed or failed.
   */
  monitor(txHash: string): TxRecord {
    const existing = this.transactions.get(txHash);
    if (existing) {
      return existing;
    }

    const record: TxRecord = {
      txHash,
      status: "PENDING",
      blockNumber: null,
      gasUsed: null,
      timestamp: Date.now(),
    };
    this.transactions.set(txHash, record);

    this.startPolling(txHash);
    return record;
  }

  /**
   * Get the current status of a monitored transaction.
   */
  getStatus(txHash: string): TxRecord | undefined {
    return this.transactions.get(txHash);
  }

  /**
   * Get all transactions currently in PENDING state.
   */
  getAllPending(): readonly TxRecord[] {
    const pending: TxRecord[] = [];
    for (const record of this.transactions.values()) {
      if (record.status === "PENDING") {
        pending.push(record);
      }
    }
    return pending;
  }

  /**
   * Stop all active polling timers. Call on shutdown.
   */
  dispose(): void {
    for (const timer of this.activePollers.values()) {
      clearInterval(timer);
    }
    this.activePollers.clear();
  }

  private startPolling(txHash: string): void {
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts += 1;

      if (attempts > MAX_POLL_ATTEMPTS) {
        this.updateRecord(txHash, "FAILED", null, null);
        this.stopPolling(txHash);
        return;
      }

      try {
        const receipt = await this.provider.getTransactionReceipt(txHash);
        if (receipt === null) {
          return; // still pending
        }

        const status: TxStatus = receipt.status === 1 ? "CONFIRMED" : "FAILED";
        this.updateRecord(
          txHash,
          status,
          receipt.blockNumber,
          receipt.gasUsed.toString(),
        );
        this.stopPolling(txHash);
      } catch {
        // Network error - keep polling
      }
    }, POLL_INTERVAL_MS);

    this.activePollers.set(txHash, timer);
  }

  private stopPolling(txHash: string): void {
    const timer = this.activePollers.get(txHash);
    if (timer) {
      clearInterval(timer);
      this.activePollers.delete(txHash);
    }
  }

  private updateRecord(
    txHash: string,
    status: TxStatus,
    blockNumber: number | null,
    gasUsed: string | null,
  ): void {
    const existing = this.transactions.get(txHash);
    if (!existing) {
      return;
    }
    // Immutable update
    const updated: TxRecord = {
      ...existing,
      status,
      blockNumber,
      gasUsed,
    };
    this.transactions.set(txHash, updated);
  }
}
