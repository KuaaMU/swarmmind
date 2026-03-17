import { AgentWallet } from "../wallet/agent-wallet";

export interface X402PaymentConfig {
    readonly wallet: AgentWallet;
    readonly facilitatorUrl: string;
}

export interface PaymentRequired {
    readonly network: string;
    readonly currency: string;
    readonly amount: string;
    readonly receiver: string;
    readonly facilitator: string;
}

/**
 * x402 fetch wrapper that automatically handles 402 Payment Required responses.
 *
 * When a service returns 402:
 * 1. Parse pricing info from response
 * 2. Sign EIP-712 payment authorization
 * 3. Retry request with X-PAYMENT header
 */
export async function x402Fetch(
    url: string,
    config: X402PaymentConfig,
    options: RequestInit = {}
): Promise<Response> {
    // First attempt without payment
    const initialResponse = await fetch(url, options);

    if (initialResponse.status !== 402) {
        return initialResponse;
    }

    // Parse 402 response for payment details
    const paymentInfo = await initialResponse.json() as { accepts: PaymentRequired };
    const pricing = paymentInfo.accepts;

    // Sign payment authorization
    const paymentHeader = await signPayment(config.wallet, pricing);

    // Retry with payment header
    const paidResponse = await fetch(url, {
        ...options,
        headers: {
            ...options.headers as Record<string, string>,
            "X-PAYMENT": paymentHeader,
        },
    });

    return paidResponse;
}

/**
 * Sign a payment authorization for x402
 */
async function signPayment(
    wallet: AgentWallet,
    pricing: PaymentRequired
): Promise<string> {
    const paymentData = {
        payer: wallet.address,
        receiver: pricing.receiver,
        amount: pricing.amount,
        currency: pricing.currency,
        network: pricing.network,
        timestamp: Date.now(),
        nonce: Math.floor(Math.random() * 1000000),
    };

    // EIP-712 typed data signing
    const domain = {
        name: "SwarmMind x402",
        version: "1",
        chainId: 196,
    };

    const types = {
        Payment: [
            { name: "payer", type: "address" },
            { name: "receiver", type: "address" },
            { name: "amount", type: "string" },
            { name: "currency", type: "string" },
            { name: "network", type: "string" },
            { name: "timestamp", type: "uint256" },
            { name: "nonce", type: "uint256" },
        ],
    };

    const signature = await wallet.getSigner().signTypedData(domain, types, paymentData);

    const header = Buffer.from(
        JSON.stringify({ ...paymentData, signature })
    ).toString("base64");

    return header;
}

/**
 * Helper to create an x402-aware HTTP client for a specific agent
 */
export function createX402Client(wallet: AgentWallet, facilitatorUrl: string) {
    const config: X402PaymentConfig = { wallet, facilitatorUrl };

    return {
        get: (url: string) => x402Fetch(url, config, { method: "GET" }),

        post: (url: string, body: object) =>
            x402Fetch(url, config, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }),
    };
}
