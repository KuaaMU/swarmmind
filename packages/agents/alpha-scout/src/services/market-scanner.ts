import { MarketApiClient, TokenPrice, TOKEN_ADDRESSES, env, ChainId } from "@swarmmind/shared";

const POLL_INTERVAL_MS = 10_000;
const CACHE_TTL_MS = 15_000;

interface PriceCache {
  readonly prices: readonly TokenPrice[];
  readonly fetchedAt: number;
}

export class MarketScanner {
  private readonly marketClient: MarketApiClient;
  private readonly chainId: ChainId;
  private readonly tokenAddresses: readonly string[];
  private cache: PriceCache | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(chainId: ChainId) {
    this.marketClient = new MarketApiClient({
      apiKey: env.okx.apiKey,
      secretKey: env.okx.secretKey,
      passphrase: env.okx.passphrase,
      projectId: env.okx.projectId,
    });

    this.chainId = chainId;
    const tokens = TOKEN_ADDRESSES[this.chainId];
    this.tokenAddresses = [tokens.WOKB, tokens.WETH, tokens.USDT, tokens.USDC];
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log("[MarketScanner] Starting price polling every %dms", POLL_INTERVAL_MS);

    this.poll();
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("[MarketScanner] Stopped");
  }

  getLatestPrices(): readonly TokenPrice[] {
    if (!this.cache) {
      return [];
    }

    const age = Date.now() - this.cache.fetchedAt;
    if (age > CACHE_TTL_MS) {
      return [];
    }

    return this.cache.prices;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async poll(): Promise<void> {
    try {
      const prices = await this.marketClient.getTokenPrices(this.tokenAddresses);
      this.cache = { prices, fetchedAt: Date.now() };
      console.log("[MarketScanner] Fetched %d token prices", prices.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[MarketScanner] Poll failed: %s", message);
    }
  }
}
