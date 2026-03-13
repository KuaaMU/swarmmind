import { describe, it, expect, vi, beforeEach } from "vitest";
import { x402Fetch, createX402Client } from "../payments/x402-client";
import type { AgentWallet } from "../wallet/agent-wallet";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockWallet(): AgentWallet {
  return {
    address: "0xPayerAddress",
    getSigner: () => ({
      signTypedData: vi.fn().mockResolvedValue("0xMockSignature"),
    }),
  } as unknown as AgentWallet;
}

describe("x402Fetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns response directly when status is not 402", async () => {
    const okResponse = { ok: true, status: 200, json: () => Promise.resolve({ data: "ok" }) } as unknown as Response;
    mockFetch.mockResolvedValueOnce(okResponse);

    const config = { wallet: createMockWallet(), facilitatorUrl: "https://x402.test" };
    const result = await x402Fetch("https://api.example.com/data", config);

    expect(result).toBe(okResponse);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("handles 402 by signing payment and retrying", async () => {
    // First call returns 402
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: () => Promise.resolve({
        accepts: {
          network: "eip155:196",
          currency: "USDC",
          amount: "0.001",
          receiver: "0xReceiver",
          facilitator: "https://x402.test",
        },
      }),
    } as unknown as Response);

    // Second call (with payment) returns 200
    const paidResponse = { ok: true, status: 200 } as unknown as Response;
    mockFetch.mockResolvedValueOnce(paidResponse);

    const wallet = createMockWallet();
    const config = { wallet, facilitatorUrl: "https://x402.test" };
    const result = await x402Fetch("https://agent.com/signals", config);

    expect(result).toBe(paidResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify second call has X-PAYMENT header
    const [, secondOpts] = mockFetch.mock.calls[1];
    expect(secondOpts.headers["X-PAYMENT"]).toBeTruthy();

    // Verify payment header is base64-encoded JSON with signature
    const decoded = JSON.parse(
      Buffer.from(secondOpts.headers["X-PAYMENT"], "base64").toString(),
    );
    expect(decoded.signature).toBe("0xMockSignature");
    expect(decoded.payer).toBe("0xPayerAddress");
    expect(decoded.amount).toBe("0.001");
  });
});

describe("createX402Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("creates a client with get and post methods", () => {
    const wallet = createMockWallet();
    const client = createX402Client(wallet, "https://x402.test");

    expect(typeof client.get).toBe("function");
    expect(typeof client.post).toBe("function");
  });

  it("get method calls x402Fetch with GET", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const wallet = createMockWallet();
    const client = createX402Client(wallet, "https://x402.test");
    await client.get("https://api.example.com/data");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.example.com/data");
    expect(opts.method).toBe("GET");
  });

  it("post method calls x402Fetch with POST and JSON body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const wallet = createMockWallet();
    const client = createX402Client(wallet, "https://x402.test");
    await client.post("https://api.example.com/assess", { signal: "data" });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual({ signal: "data" });
  });
});
