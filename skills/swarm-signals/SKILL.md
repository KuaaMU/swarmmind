---
name: swarm-signals
description: Get real-time DeFi trading signals from SwarmMind's Alpha Scout agent - analyzes X Layer DEX data for arbitrage, momentum, and mean reversion opportunities
---

# SwarmMind Signals

## Overview

Alpha Scout is SwarmMind's market intelligence agent. It analyzes X Layer DEX data to identify trading opportunities across three signal types.

## API Endpoints

### Get Latest Signals

```bash
# Direct API call
curl http://localhost:3001/signals/latest

# Via Portfolio Manager (x402 payment included)
curl -X POST http://localhost:3000/orchestrate/react \
  -H "Content-Type: application/json" \
  -d '{"strategy": "Scan for arbitrage opportunities on OKB/USDC"}'
```

### Signal Format

```json
{
  "id": "sig-abc123",
  "type": "ARBITRAGE",
  "tokenPair": "OKB/USDC",
  "direction": "BUY",
  "confidence": 0.75,
  "entryPrice": 45.20,
  "targetPrice": 46.10,
  "stopLoss": 44.80,
  "rationale": "2.1% price gap between OKX DEX pool A and pool B",
  "timestamp": 1711234567890,
  "source": "alpha-scout"
}
```

## Signal Types

| Type | Description | Typical Confidence |
|------|-------------|-------------------|
| `ARBITRAGE` | Cross-DEX price differences | 0.6-0.9 |
| `MOMENTUM` | Strong directional moves | 0.4-0.8 |
| `MEAN_REVERSION` | Oversold/overbought conditions | 0.3-0.7 |

## x402 Payment Flow

When accessed through the Portfolio Manager's ReAct orchestrator:

1. Portfolio Manager calls Alpha Scout via x402-enabled HTTP
2. Payment is automatically negotiated and settled on X Layer
3. Signal data is returned and fed to the LLM for decision-making

## Confidence Interpretation

- **> 0.8**: High confidence - strong, clear opportunity
- **0.5-0.8**: Medium confidence - viable but needs risk assessment
- **< 0.5**: Low confidence - speculative, orchestrator may skip

## onchainos Integration

- Complements `dex-signal` skill with AI-powered analysis
- Works alongside `dex-market` for broader market context
- Signal format is compatible with onchainos agent messaging
