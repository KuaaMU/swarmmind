---
name: swarm-risk
description: Assess DeFi trade risk using SwarmMind's Risk Oracle agent - evaluates volatility, liquidity depth, smart contract risk, and market conditions on X Layer
---

# SwarmMind Risk Assessment

## Overview

Risk Oracle evaluates proposed trades and provides risk scores, maximum drawdown estimates, and recommendations. It considers liquidity, volatility, position sizing, and smart contract risk.

## API Endpoints

### Assess Trade Risk

```bash
# Direct API call
curl -X POST http://localhost:3002/assess/trade \
  -H "Content-Type: application/json" \
  -d '{"id":"sig-1","type":"ARBITRAGE","tokenPair":"OKB/USDC","direction":"BUY","confidence":0.75,"entryPrice":45.2,"targetPrice":46.1,"stopLoss":44.8,"rationale":"price gap","timestamp":1711234567890,"source":"alpha-scout"}'

# Via ReAct orchestrator (automated)
# The LLM calls assess_risk tool with signal_id after scanning signals
```

### Assessment Format

```json
{
  "signalId": "sig-abc123",
  "riskScore": 4,
  "maxDrawdown": 0.03,
  "recommendation": "PROCEED",
  "rationale": "Low volatility period, adequate liquidity for position size",
  "timestamp": 1711234567890
}
```

## Risk Score Interpretation

| Score | Level | Recommendation |
|-------|-------|---------------|
| 1-3 | Low risk | PROCEED - safe to execute |
| 4-5 | Medium risk | CAUTION - consider reducing size |
| 6-7 | High risk | CAUTION - only for aggressive strategies |
| 8-10 | Very high risk | REJECT - conditions unfavorable |

## Strategy-Aware Thresholds

The ReAct orchestrator applies risk thresholds based on user strategy:

- **CONSERVATIVE** (LOW tolerance): Rejects signals with riskScore > 3
- **BALANCED** (MEDIUM tolerance): Rejects signals with riskScore > 5
- **AGGRESSIVE** (HIGH tolerance): Rejects signals with riskScore > 7

## Risk Factors Evaluated

1. **Token Liquidity** - Pool depth on X Layer DEXs
2. **Historical Volatility** - Price swing magnitude over recent periods
3. **Position Size** - Trade amount vs available liquidity
4. **Smart Contract Risk** - New vs established tokens
5. **Market Conditions** - Trending vs ranging market

## x402 Payment Flow

Risk assessment is paid per-call via x402 micropayments on X Layer. The Portfolio Manager handles payment automatically during ReAct cycles.

## onchainos Integration

- Extends `dex-market` risk signals with AI-powered assessment
- Compatible with onchainos agent trust scoring
