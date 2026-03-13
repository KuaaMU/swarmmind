import { describe, it, expect, vi, beforeEach } from "vitest";
import { x402PaymentMiddleware, type X402PricingConfig } from "../payments/x402-server";
import type { Request, Response, NextFunction } from "express";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const PRICING_CONFIG: X402PricingConfig = {
  network: "eip155:196",
  currency: "USDC",
  amount: "0.001",
  receiverAddress: "0xReceiver",
  facilitatorUrl: "https://x402.example.com",
  description: "Signal data access",
};

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("x402PaymentMiddleware", () => {
  const middleware = x402PaymentMiddleware(PRICING_CONFIG);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns 402 when no X-PAYMENT header", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next as NextFunction);

    expect(res.statusCode).toBe(402);
    expect((res.body as { error: string }).error).toBe("Payment Required");
    expect((res.body as { accepts: { amount: string } }).accepts.amount).toBe("0.001");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when facilitator verifies payment", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ valid: true }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response); // settle call

    const paymentHeader = Buffer.from(
      JSON.stringify({ payer: "0x1", amount: "0.001", signature: "0xSig" }),
    ).toString("base64");

    const req = mockReq({ "x-payment": paymentHeader });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2); // verify + settle
  });

  it("returns 402 when facilitator rejects payment", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: false }),
    } as Response);

    const req = mockReq({ "x-payment": "invalid-header" });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next as NextFunction);

    expect(res.statusCode).toBe(402);
    expect((res.body as { error: string }).error).toBe("Payment verification failed");
    expect(next).not.toHaveBeenCalled();
  });

  it("falls back to format validation when facilitator is unreachable", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Connection refused"))
      .mockResolvedValueOnce({ ok: true } as Response); // settle (also fails but caught)

    const paymentHeader = Buffer.from(
      JSON.stringify({ payer: "0xAddr", amount: "0.001", signature: "0xSig123" }),
    ).toString("base64");

    const req = mockReq({ "x-payment": paymentHeader });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next as NextFunction);

    // Should pass because the header has valid format (payer + amount + signature)
    expect(next).toHaveBeenCalledOnce();
  });

  it("includes pricing details in 402 response", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as unknown as Response, next as NextFunction);

    const body = res.body as {
      accepts: { network: string; currency: string; receiver: string; description: string };
    };
    expect(body.accepts.network).toBe("eip155:196");
    expect(body.accepts.currency).toBe("USDC");
    expect(body.accepts.receiver).toBe("0xReceiver");
    expect(body.accepts.description).toBe("Signal data access");
  });
});
