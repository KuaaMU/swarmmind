import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { createOkxAuthHeaders, type OkxAuthConfig } from "../okx/auth";

const TEST_CONFIG: OkxAuthConfig = {
  apiKey: "test-api-key",
  secretKey: "test-secret-key",
  passphrase: "test-passphrase",
  projectId: "test-project-id",
};

describe("createOkxAuthHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T12:00:00.000Z"));
  });

  it("returns all required OKX auth headers", () => {
    const headers = createOkxAuthHeaders(TEST_CONFIG, "GET", "/api/v5/test");

    expect(headers["OK-ACCESS-KEY"]).toBe("test-api-key");
    expect(headers["OK-ACCESS-PASSPHRASE"]).toBe("test-passphrase");
    expect(headers["OK-ACCESS-PROJECT"]).toBe("test-project-id");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["OK-ACCESS-TIMESTAMP"]).toBeTruthy();
    expect(headers["OK-ACCESS-SIGN"]).toBeTruthy();
  });

  it("generates correct HMAC-SHA256 signature for GET", () => {
    const headers = createOkxAuthHeaders(TEST_CONFIG, "GET", "/api/v5/dex/market/prices");
    const timestamp = headers["OK-ACCESS-TIMESTAMP"];

    const expectedPreHash = `${timestamp}GET/api/v5/dex/market/prices`;
    const expectedSignature = crypto
      .createHmac("sha256", "test-secret-key")
      .update(expectedPreHash)
      .digest("base64");

    expect(headers["OK-ACCESS-SIGN"]).toBe(expectedSignature);
  });

  it("includes body in signature for POST requests", () => {
    const body = '{"key":"value"}';
    const headers = createOkxAuthHeaders(TEST_CONFIG, "POST", "/api/v5/test", body);
    const timestamp = headers["OK-ACCESS-TIMESTAMP"];

    const expectedPreHash = `${timestamp}POST/api/v5/test${body}`;
    const expectedSignature = crypto
      .createHmac("sha256", "test-secret-key")
      .update(expectedPreHash)
      .digest("base64");

    expect(headers["OK-ACCESS-SIGN"]).toBe(expectedSignature);
  });

  it("uppercases the HTTP method in signature", () => {
    const h1 = createOkxAuthHeaders(TEST_CONFIG, "get", "/path");
    const h2 = createOkxAuthHeaders(TEST_CONFIG, "GET", "/path");
    expect(h1["OK-ACCESS-SIGN"]).toBe(h2["OK-ACCESS-SIGN"]);
  });

  it("uses ISO timestamp format", () => {
    const headers = createOkxAuthHeaders(TEST_CONFIG, "GET", "/test");
    expect(headers["OK-ACCESS-TIMESTAMP"]).toBe("2026-03-13T12:00:00.000Z");
  });

  vi.useRealTimers();
});
