/**
 * Quick test: verify AI client can connect to the configured provider.
 * Run: npx ts-node scripts/test-ai.ts
 */
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createAIClientFromEnv } from "@swarmmind/shared";

async function main() {
  console.log("=== AI Client Connectivity Test ===\n");
  console.log("Provider:", process.env.AI_PROVIDER || "anthropic");
  console.log("Model:", process.env.AI_MODEL || "(default)");
  console.log("Base URL:", process.env.AI_BASE_URL ? "custom relay" : "official endpoint");

  const client = createAIClientFromEnv();
  console.log(`\nClient: provider=${client.getProvider()}, model=${client.getModel()}`);
  console.log("\nSending test prompt...");

  const start = Date.now();
  const response = await client.chat(
    "You are a DeFi trading assistant. Respond concisely.",
    "Analyze the current market conditions for OKB/USDT. Give a brief 2-sentence assessment.",
  );
  const elapsed = Date.now() - start;

  console.log(`\nResponse (${elapsed}ms):`);
  console.log(response.text);
  console.log(`\nUsage: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`);
  console.log(`Model used: ${response.model}`);

  // Test structured output
  console.log("\n--- Structured JSON test ---");
  const structured = await client.structuredChat<{
    sentiment: string;
    confidence: number;
    summary: string;
  }>(
    "You are a market analyst. Respond with JSON: { sentiment: 'bullish'|'bearish'|'neutral', confidence: 0-1, summary: string }",
    "What is the general market sentiment for DeFi tokens?",
  );
  console.log("Parsed JSON:", JSON.stringify(structured, null, 2));
  console.log("\nAI connectivity test PASSED");
}

main().catch((err) => {
  console.error("AI connectivity test FAILED:", err.message);
  process.exit(1);
});
