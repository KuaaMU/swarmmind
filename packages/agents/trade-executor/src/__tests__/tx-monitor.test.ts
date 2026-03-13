import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TxMonitor, TxStatus } from "../services/tx-monitor";

function createMockProvider() {
  return {
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
  } as any;
}

describe("TxMonitor", () => {
  let monitor: TxMonitor;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProvider = createMockProvider();
    monitor = new TxMonitor(mockProvider);
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers();
  });

  describe("monitor", () => {
    it("creates a PENDING record for new transaction", () => {
      const record = monitor.monitor("0xabc123");

      expect(record.txHash).toBe("0xabc123");
      expect(record.status).toBe("PENDING");
      expect(record.blockNumber).toBeNull();
      expect(record.gasUsed).toBeNull();
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it("returns existing record if already monitored", () => {
      const first = monitor.monitor("0xabc123");
      const second = monitor.monitor("0xabc123");

      expect(first).toBe(second);
    });
  });

  describe("getStatus", () => {
    it("returns undefined for unknown transaction", () => {
      expect(monitor.getStatus("0xunknown")).toBeUndefined();
    });

    it("returns the current record", () => {
      monitor.monitor("0xabc123");
      const status = monitor.getStatus("0xabc123");

      expect(status).toBeDefined();
      expect(status!.txHash).toBe("0xabc123");
    });

    it("updates to CONFIRMED when receipt arrives with status 1", async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce({
        status: 1,
        blockNumber: 42,
        gasUsed: BigInt(21000),
      });

      monitor.monitor("0xconfirmed");

      // Advance past the polling interval (2000ms)
      await vi.advanceTimersByTimeAsync(2100);

      const record = monitor.getStatus("0xconfirmed");
      expect(record!.status).toBe("CONFIRMED");
      expect(record!.blockNumber).toBe(42);
      expect(record!.gasUsed).toBe("21000");
    });

    it("updates to FAILED when receipt arrives with status 0", async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce({
        status: 0,
        blockNumber: 43,
        gasUsed: BigInt(30000),
      });

      monitor.monitor("0xfailed");

      await vi.advanceTimersByTimeAsync(2100);

      const record = monitor.getStatus("0xfailed");
      expect(record!.status).toBe("FAILED");
      expect(record!.blockNumber).toBe(43);
    });

    it("stays PENDING while receipt is null", async () => {
      monitor.monitor("0xpending");

      await vi.advanceTimersByTimeAsync(2100);

      const record = monitor.getStatus("0xpending");
      expect(record!.status).toBe("PENDING");
    });
  });

  describe("getAllPending", () => {
    it("returns empty array when no transactions", () => {
      expect(monitor.getAllPending()).toEqual([]);
    });

    it("returns only pending transactions", async () => {
      mockProvider.getTransactionReceipt
        .mockResolvedValueOnce(null) // first call for 0xtx1
        .mockResolvedValueOnce(null) // first call for 0xtx2
        .mockResolvedValueOnce({     // second call for 0xtx1
          status: 1,
          blockNumber: 100,
          gasUsed: BigInt(21000),
        });

      monitor.monitor("0xtx1");
      monitor.monitor("0xtx2");

      expect(monitor.getAllPending()).toHaveLength(2);

      // After two polling cycles, tx1 should confirm
      await vi.advanceTimersByTimeAsync(2100);
      await vi.advanceTimersByTimeAsync(2100);

      const pending = monitor.getAllPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].txHash).toBe("0xtx2");
    });
  });

  describe("polling timeout", () => {
    it("marks transaction as FAILED after max attempts", async () => {
      // Always return null (never confirms)
      mockProvider.getTransactionReceipt.mockResolvedValue(null);

      monitor.monitor("0xtimeout");

      // 150 attempts * 2000ms = 300000ms
      // Need to advance past 150 polls
      for (let i = 0; i <= 150; i++) {
        await vi.advanceTimersByTimeAsync(2100);
      }

      const record = monitor.getStatus("0xtimeout");
      expect(record!.status).toBe("FAILED");
    });
  });

  describe("dispose", () => {
    it("stops all polling", () => {
      monitor.monitor("0xtx1");
      monitor.monitor("0xtx2");

      monitor.dispose();

      // After dispose, provider should not receive new calls
      const callsBefore = mockProvider.getTransactionReceipt.mock.calls.length;
      vi.advanceTimersByTime(10000);
      const callsAfter = mockProvider.getTransactionReceipt.mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });
  });

  describe("network error resilience", () => {
    it("keeps polling after network error", async () => {
      mockProvider.getTransactionReceipt
        .mockRejectedValueOnce(new Error("network timeout"))
        .mockResolvedValueOnce({
          status: 1,
          blockNumber: 50,
          gasUsed: BigInt(21000),
        });

      monitor.monitor("0xrecover");

      // First poll: network error
      await vi.advanceTimersByTimeAsync(2100);
      expect(monitor.getStatus("0xrecover")!.status).toBe("PENDING");

      // Second poll: succeeds
      await vi.advanceTimersByTimeAsync(2100);
      expect(monitor.getStatus("0xrecover")!.status).toBe("CONFIRMED");
    });
  });
});
