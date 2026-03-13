import crypto from "crypto";

export interface OkxAuthHeaders {
  readonly "OK-ACCESS-KEY": string;
  readonly "OK-ACCESS-SIGN": string;
  readonly "OK-ACCESS-TIMESTAMP": string;
  readonly "OK-ACCESS-PASSPHRASE": string;
  readonly "OK-ACCESS-PROJECT": string;
  readonly "Content-Type": string;
}

export interface OkxAuthConfig {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly passphrase: string;
  readonly projectId: string;
}

/**
 * Generate HMAC-SHA256 authentication headers for OKX OnchainOS API
 * @see https://web3.okx.com/onchainos/dev-docs/home/developer-portal
 */
export function createOkxAuthHeaders(
  config: OkxAuthConfig,
  method: string,
  requestPath: string,
  body?: string
): OkxAuthHeaders {
  const timestamp = new Date().toISOString();
  const preHash = timestamp + method.toUpperCase() + requestPath + (body || "");

  const signature = crypto
    .createHmac("sha256", config.secretKey)
    .update(preHash)
    .digest("base64");

  return {
    "OK-ACCESS-KEY": config.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": config.passphrase,
    "OK-ACCESS-PROJECT": config.projectId,
    "Content-Type": "application/json",
  };
}
