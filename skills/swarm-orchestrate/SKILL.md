---
name: swarm-orchestrate
description: Run SwarmMind's autonomous DeFi intelligence cycle - coordinates market scanning, risk assessment, and trade execution across specialized AI agents with x402 micropayments on X Layer
---

# SwarmMind Orchestration

## Overview

SwarmMind's Portfolio Manager uses a ReAct (Reasoning + Acting) loop to autonomously coordinate a swarm of specialized DeFi agents. The LLM dynamically decides which agents to call, in what order, and how to react to results.

## Quick Start

```bash
# 1. Start all agents
cd packages/agents/alpha-scout && npm run dev &
cd packages/agents/risk-oracle && npm run dev &
cd packages/agents/trade-executor && npm run dev &
cd packages/agents/portfolio-manager && npm run dev &

# 2. Set a strategy
curl -X POST http://localhost:3000/strategy \
  -H "Content-Type: application/json" \
  -d '{"strategy": "Conservative DeFi trading on X Layer, max $50 per position"}'

# 3. Run one ReAct cycle
curl -X POST http://localhost:3000/orchestrate/react

# 4. View reasoning trace
curl http://localhost:3000/reasoning/latest
```

## How the ReAct Loop Works

1. **Context**: Portfolio state + user strategy are provided to the LLM
2. **Reason**: LLM analyzes context and decides which tool to call
3. **Act**: Tool is executed (HTTP call to agent service with x402 payment)
4. **Observe**: Result is fed back to the LLM
5. **Repeat**: Until the LLM decides the cycle is complete

## Available Tools

| Tool | Agent | Description |
|------|-------|-------------|
| `get_market_signals` | Alpha Scout | Fetch trading signals (ARBITRAGE, MOMENTUM, MEAN_REVERSION) |
| `assess_risk` | Risk Oracle | Evaluate signal risk (score 1-10, PROCEED/CAUTION/REJECT) |
| `assess_liquidity` | Liquidity Agent | Check pool depth (DEEP/ADEQUATE/SHALLOW/AVOID) |
| `execute_trade` | Trade Executor | Execute swap via OKX DEX aggregator |
| `get_portfolio_state` | Portfolio Manager | Current positions, balances, recent trades |
| `check_agent_status` | All | Health check for any agent |

## WebSocket Events

Connect to `ws://localhost:3000` to receive real-time events:

- `TOOL_CALL` - Tool invocation (request/response phases)
- `SIGNAL_DETECTED` - New trading signal found
- `RISK_ASSESSED` - Risk evaluation completed
- `TRADE_EXECUTED` - Trade confirmed
- `LIQUIDITY_ASSESSED` - Pool liquidity checked
- `PORTFOLIO_UPDATE` - State updated after cycle

## Strategy Configuration

Strategies are parsed by the LLM into structured parameters:

```json
{
  "riskTolerance": "LOW | MEDIUM | HIGH",
  "maxPositionSize": 100,
  "preferredTokens": ["OKB", "USDC"],
  "strategyType": "CONSERVATIVE | BALANCED | AGGRESSIVE",
  "constraints": ["Only trade OKB/USDC pair"]
}
```

## onchainos Cross-Skill Workflows

SwarmMind integrates with the onchainos skill ecosystem:

- **dex-signal + swarm-signals**: Combine onchainos DEX signals with Alpha Scout analysis for broader market coverage
- **dex-swap + swarm-trade**: Use onchainos swap routing alongside SwarmMind's risk-assessed execution
- **wallet-portfolio + swarm-orchestrate**: Extend onchainos portfolio view with SwarmMind's autonomous management
- **onchain-gateway + swarm-orchestrate**: Use onchainos gateway for cross-chain signals feeding into SwarmMind's ReAct loop
