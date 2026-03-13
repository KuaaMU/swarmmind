import * as dotenv from "dotenv";
import path from "path";

// Try multiple .env locations (agent packages are nested at different depths)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Read an env var, returning empty string if missing.
 * Use for keys that are validated at service startup, not at import time.
 */
function lazyEnv(name: string): string {
  return process.env[name] || "";
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Resolve the AI API key based on the selected provider.
 * Allows each agent to potentially use a different provider.
 */
function resolveAIKey(): string {
  const provider = optionalEnv("AI_PROVIDER", "anthropic");
  const keyMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  const envVar = keyMap[provider] || "ANTHROPIC_API_KEY";
  return requireEnv(envVar);
}

export const env = {
  // OKX API (validated at agent startup, not import time)
  okx: {
    apiKey: lazyEnv("OKX_API_KEY"),
    secretKey: lazyEnv("OKX_SECRET_KEY"),
    passphrase: lazyEnv("OKX_PASSPHRASE"),
    projectId: lazyEnv("OKX_PROJECT_ID"),
  },

  // AI Provider (multi-model support, validated via createAIClientFromEnv)
  ai: {
    provider: optionalEnv("AI_PROVIDER", "anthropic"),
    apiKey: lazyEnv("ANTHROPIC_API_KEY"),
    model: optionalEnv("AI_MODEL", ""),
    baseUrl: optionalEnv("AI_BASE_URL", ""),
  },

  // Legacy: keep anthropic field for backward compatibility
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  },

  // X Layer
  xlayer: {
    rpcUrl: optionalEnv("XLAYER_RPC_URL", "https://rpc.xlayer.tech"),
    chainId: parseInt(optionalEnv("XLAYER_CHAIN_ID", "196")),
  },

  // Contract addresses
  contracts: {
    agentRegistry: optionalEnv("AGENT_REGISTRY_ADDRESS", ""),
    walletFactory: optionalEnv("WALLET_FACTORY_ADDRESS", ""),
    paymentSettlement: optionalEnv("PAYMENT_SETTLEMENT_ADDRESS", ""),
    usdc: optionalEnv("USDC_ADDRESS", "0x74b7F16337b8972027F6196A17a631aC6dE26d22"),
  },

  // Agent ports
  ports: {
    portfolioManager: parseInt(optionalEnv("PORTFOLIO_MANAGER_PORT", "3000")),
    alphaScout: parseInt(optionalEnv("ALPHA_SCOUT_PORT", "3001")),
    riskOracle: parseInt(optionalEnv("RISK_ORACLE_PORT", "3002")),
    tradeExecutor: parseInt(optionalEnv("TRADE_EXECUTOR_PORT", "3003")),
    dashboard: parseInt(optionalEnv("DASHBOARD_PORT", "3100")),
  },

  // x402
  x402: {
    facilitatorUrl: optionalEnv("X402_FACILITATOR_URL", "https://x402.thirdweb.com"),
  },
} as const;

/**
 * Validate that required environment variables are set.
 * Call this at agent startup (not at import time) to fail fast.
 */
export function validateRequiredEnv(keys: readonly string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
