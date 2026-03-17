---
name: swarm-trade
description: Execute DeFi trades through SwarmMind's Trade Executor agent - routes orders through OKX DEX aggregator on X Layer with slippage protection
---

# SwarmMind Trade Execution

## Overview

Trade Executor routes orders through the OKX DEX aggregator on X Layer. It handles token approvals, slippage protection, and transaction monitoring.

## API Endpoints

### Execute Swap

```bash
# Direct API call
curl -X POST http://localhost:3003/execute/swap \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: <wallet-address>" \
  -d '{"signalId":"sig-1","tokenPair":"OKB/USDC","direction":"BUY","entryPrice":45.2,"amount":"100"}'

# Via ReAct orchestrator (automated with risk check)
# The LLM calls execute_trade tool only after assess_risk returns PROCEED
```

### Execution Format

```json
{
  "id": "trade-xyz789",
  "signalId": "sig-abc123",
  "tokenIn": "USDC",
  "tokenOut": "OKB",
  "amountIn": "100",
  "amountOut": "2.21",
  "txHash": "0xabc...def",
  "status": "COMPLETED",
  "timestamp": 1711234567890,
  "gasUsed": "150000"
}
```

## Trade Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Trade submitted, awaiting confirmation |
| `APPROVED` | Risk-checked and approved for execution |
| `EXECUTING` | Transaction submitted to X Layer |
| `COMPLETED` | Trade confirmed on-chain |
| `FAILED` | Transaction reverted or timed out |

## Safety Features

- **Slippage Protection**: Maximum slippage configured per trade
- **Position Size Limits**: Enforced by strategy maxPositionSize
- **Risk Gate**: ReAct orchestrator checks risk before executing
- **Liquidity Check**: Optional liquidity assessment via Liquidity Agent

## x402 Payment Flow

Trade execution includes x402 micropayment for the service:

1. Portfolio Manager sends trade request with x402 payment
2. Trade Executor verifies payment
3. Swap is routed through OKX DEX aggregator
4. Result and payment receipt are returned

## ReAct Orchestrator Integration

In the ReAct loop, trade execution is the final step:

1. `get_market_signals` - Find opportunities
2. `assess_risk` - Evaluate risk (must return PROCEED)
3. `assess_liquidity` - Optional depth check
4. `execute_trade` - Execute if all checks pass

The LLM may skip execution based on any unfavorable result.

## onchainos Integration

- Works alongside `dex-swap` for cross-protocol routing
- Compatible with `onchain-gateway` for cross-chain execution
- Trade receipts are compatible with onchainos transaction tracking
