<p align="center">
  <img src="assets/banner.png" alt="SwarmMind Banner" width="800"/>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a> | English
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-185%20passing-brightgreen" alt="Tests"/>
  <img src="https://img.shields.io/badge/contracts-3%20deployed-blue" alt="Contracts"/>
  <img src="https://img.shields.io/badge/agents-5%20autonomous-purple" alt="Agents"/>
  <img src="https://img.shields.io/badge/chain-X%20Layer%20196-orange" alt="Chain"/>
  <img src="https://img.shields.io/badge/license-MIT-gray" alt="License"/>
</p>

SwarmMind is an autonomous multi-agent DeFi intelligence network where specialized AI agents discover, assess, and execute trading opportunities on X Layer, paying each other for services via x402 micropayments. The orchestrator uses a **ReAct (Reasoning + Acting) loop** where the LLM dynamically decides which agents to call, in what order, and how to react to results.

Built for the [X Layer AI Hackathon](https://x.com/XLayerOfficial) (Phase 1: Mar 12-26, 2026).

## Why SwarmMind Wins

| Judging Criteria | How SwarmMind Delivers |
|---|---|
| **Deep AI-Agent On-Chain Integration** | 5 AI agents with dedicated wallets, on-chain registration, and autonomous decision-making via ReAct tool-use loop |
| **Autonomous Payment Flows** | x402 HTTP micropayments between agents, settled on X Layer in USDC - LLM decides when to pay |
| **Multi-Agent Collaboration** | Economic incentives: Scouts sell signals, Oracles sell risk assessments, PM orchestrates dynamically |
| **Ecosystem Impact** | Reusable infrastructure: AgentRegistry, WalletFactory, PaymentSettlement contracts + MCP server, CLI, SKILL.md plugin |
| **OKX OnchainOS** | Market API for data, Trade API for DEX swaps, onchainos-skills compatible |

## Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="SwarmMind Architecture" width="700"/>
</p>

### ReAct Orchestration

The Portfolio Manager uses a **ReAct (Reasoning + Acting) loop** where the LLM dynamically decides which agents to call:

```
ReActOrchestrator.runOnce():
  messages = [systemPrompt + portfolio context]
  loop (max 10 iterations):
    response = llm.chatWithTools(messages, tools)
    if response.hasToolCalls:
      for each toolCall:
        result = execute(toolCall)     // calls agent HTTP APIs
        messages.push(toolResult)      // feed result back to LLM
        emit("TOOL_CALL", result)      // WebSocket broadcast
    else:
      break  // LLM decided it's done
```

The LLM **dynamically decides**:
- Which agents to call and in what order
- Whether to proceed or abort based on risk scores
- How to react to unexpected results (e.g., low liquidity, high slippage)
- When the orchestration cycle is complete

### Agent Roles

| Agent | Role | Port | Payment |
|-------|------|------|---------|
| **Portfolio Manager** | ReAct orchestrator - LLM-driven tool-use loop | 3000 | Pays others via x402 |
| **Alpha Scout** | Market intelligence - detects trading signals via AI | 3001 | Sells signals ($0.001-$0.005 USDC) |
| **Risk Oracle** | Risk assessment - evaluates trade proposals via AI | 3002 | Sells assessments ($0.001-$0.002 USDC) |
| **Liquidity Agent** | Pool analysis - assesses DEX liquidity depth | - | Sells assessments ($0.001 USDC) |
| **Trade Executor** | DEX execution - swaps tokens on X Layer | 3003 | Internal (API-key protected) |

### Payment Flow (x402 Protocol)

```
Portfolio Manager  ──GET /signals/latest──>  Alpha Scout
                   <──402 Payment Required──
                   ──Signs EIP-712 auth────>
                   <──200 OK + signal data──  (USDC settled on X Layer)
```

1. Portfolio Manager requests data from Alpha Scout / Risk Oracle
2. Service returns `402 Payment Required` with USDC pricing on `eip155:196`
3. Portfolio Manager signs EIP-712 payment authorization
4. Payment settles on X Layer via USDC transfer
5. Service delivers data

## Deployed Contracts (X Layer Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| AgentRegistry | [`0xf159428B2909159e2dd14aF0EFF37fe8fEb4C46f`](https://www.oklink.com/xlayer-test/address/0xf159428B2909159e2dd14aF0EFF37fe8fEb4C46f) | On-chain agent directory & reputation |
| AgentWalletFactory | [`0xE1c33aaC0fFe7DF85dD37a00f537e3f210348546`](https://www.oklink.com/xlayer-test/address/0xE1c33aaC0fFe7DF85dD37a00f537e3f210348546) | CREATE2 deterministic wallet factory |
| PaymentSettlement | [`0xEF334ADc78f78650C869baCdc88D1BA0D87B9aE8`](https://www.oklink.com/xlayer-test/address/0xEF334ADc78f78650C869baCdc88D1BA0D87B9aE8) | USDC payment audit trail |

### On-Chain Transaction Proof

**Agent Registration TXs:**
- Alpha Scout: [`0x86195729...`](https://www.oklink.com/xlayer-test/tx/0x86195729a9de9f82dcec78f8e304f20a9454ba87bb7b0f86848c30954d657d4e)
- Risk Oracle: [`0x53bb8f78...`](https://www.oklink.com/xlayer-test/tx/0x53bb8f785ea176fe3d2632481f45d00cbfd820a316de7d58d6f9f979c1b66094)
- Trade Executor: [`0x0ecfed4f...`](https://www.oklink.com/xlayer-test/tx/0x0ecfed4f1d294b69fdf299a76b7ea00030e5684db74b9271e67ef619f65cdc38)
- Portfolio Manager: [`0xcc8fb97b...`](https://www.oklink.com/xlayer-test/tx/0xcc8fb97be359039e68a93038744ce4553aad785ffba6a369404910cfe08480b1)

**Agent Payment TXs (x402 simulation):**
- PM -> Alpha Scout: [`0xaa788ab3...`](https://www.oklink.com/xlayer-test/tx/0xaa788ab38f912e03b1d37c380668f99260d5348a27c9d21fc4da919a50815576)
- PM -> Risk Oracle: [`0x3f941778...`](https://www.oklink.com/xlayer-test/tx/0x3f941778de0dcb0197e62d8c5a671e99c83325f5627bf0194e4df7a094c0d035)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24 + Hardhat + OpenZeppelin |
| Backend/Agents | TypeScript + Node.js + Express |
| AI Reasoning | ReAct tool-use loop, multi-provider (Claude, GPT, DeepSeek, OpenRouter) |
| DEX Trading | OKX OnchainOS Trade API (`/dex/aggregator`) |
| Market Data | OKX OnchainOS Market API |
| Payments | x402 HTTP protocol + direct USDC settlement |
| Frontend | Next.js + TailwindCSS + Recharts |
| Blockchain | ethers.js v6, X Layer (Chain ID 196) |
| Integrations | MCP server, Claude Code SKILL.md plugin, CLI tool |
| Monorepo | Turborepo + npm workspaces |
| Testing | Vitest (agents) + Hardhat/Chai (contracts) |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- OKB on X Layer for gas (~$0.001/tx)
- One AI API key (Anthropic, OpenAI, DeepSeek, or OpenRouter)

### Setup

```bash
git clone https://github.com/KuaaMU/swarmmind.git
cd swarmmind
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and wallet private keys

# Build all packages
npm run build
```

### Run Tests

```bash
# All tests (185 passing)
npm test

# Or individually:
# Smart contract tests (29 tests)
cd packages/contracts && npx hardhat test

# Agent unit tests (156 tests)
# shared: 47 | alpha-scout: 8 | risk-oracle: 21 | portfolio-manager: 40 | trade-executor: 25 | liquidity-agent: 15
npx vitest run
```

### Deploy Contracts

```bash
cd packages/contracts

# Testnet
npx hardhat run scripts/deploy.ts --network xlayerTestnet

# Register agents on-chain
npx hardhat run scripts/register-agents.ts --network xlayerTestnet

# Mainnet
npx hardhat run scripts/deploy.ts --network xlayer
```

### Run E2E Demo

```bash
# Full demo: agent verification -> signals -> risk -> payments (on-chain)
npx tsx scripts/demo-e2e.ts
```

### Run Agents

```bash
# Development mode (all agents via Turborepo)
npm run dev

# Or individually
cd packages/agents/alpha-scout && npm run dev
cd packages/agents/risk-oracle && npm run dev
cd packages/agents/trade-executor && npm run dev
cd packages/agents/portfolio-manager && npm run dev
```

### Dashboard

```bash
cd packages/dashboard && npm run dev
# Open http://localhost:3100
# Works without backend - auto-activates demo mode with simulated agent activity
```

## Smart Contracts

### AgentRegistry.sol (~130 lines)
On-chain agent service directory. Stores wallet address, name, role (SCOUT/ORACLE/EXECUTOR/MANAGER), service endpoint, pricing, and earnings/spending counters.

- `registerAgent()` - Register a new AI agent
- `updatePricing()` - Update service pricing
- `recordPayment()` - Record inter-agent payment (called by PaymentSettlement)
- `getActiveAgentsByRole()` - Query agents by role
- Events: `AgentRegistered`, `PricingUpdated`, `PaymentRecorded`, `AgentDeactivated`

### AgentWalletFactory.sol (~80 lines)
CREATE2 deterministic wallet creation via OpenZeppelin Clones (minimal proxy pattern). Each wallet: `execute()`, `approve()`, `withdraw()` (owner-only). ~$0.001 deployment cost per wallet.

### PaymentSettlement.sol (~120 lines)
Records USDC agent-to-agent transfers with on-chain audit trail. Supports single + batch settlement. Links to AgentRegistry for earnings/spending tracking.

## Project Structure

```
swarmmind/
├── packages/
│   ├── contracts/                  # Solidity smart contracts
│   │   ├── contracts/
│   │   │   ├── AgentRegistry.sol
│   │   │   ├── AgentWalletFactory.sol
│   │   │   ├── PaymentSettlement.sol
│   │   │   └── interfaces/
│   │   ├── scripts/
│   │   │   ├── deploy.ts
│   │   │   └── register-agents.ts
│   │   └── test/contracts.test.ts  # 29 Hardhat tests
│   │
│   ├── agents/
│   │   ├── shared/                 # Common infrastructure
│   │   │   └── src/
│   │   │       ├── ai/            # Multi-provider AI client + tool-use
│   │   │       ├── okx/           # OnchainOS Market + Trade API
│   │   │       ├── payments/      # x402 client/server + direct payment
│   │   │       ├── wallet/        # Agent wallet (ethers.js)
│   │   │       ├── config/        # X Layer config + env validation
│   │   │       └── types.ts       # Shared TypeScript types
│   │   │
│   │   ├── alpha-scout/           # Market signal agent (port 3001)
│   │   ├── risk-oracle/           # Risk assessment agent (port 3002)
│   │   ├── trade-executor/        # DEX swap agent (port 3003)
│   │   ├── liquidity-agent/       # Pool liquidity analysis
│   │   └── portfolio-manager/     # ReAct orchestrator agent (port 3000)
│   │       └── src/
│   │           ├── tools/         # Tool definitions for ReAct loop
│   │           └── services/      # ReActOrchestrator + legacy orchestrator
│   │
│   ├── mcp-server/                # MCP server (Model Context Protocol)
│   ├── cli/                       # CLI tool (@swarmmind/cli)
│   └── dashboard/                 # Next.js frontend
│
├── skills/                        # Claude Code SKILL.md plugin
│   ├── swarm-orchestrate/
│   ├── swarm-signals/
│   ├── swarm-risk/
│   └── swarm-trade/
│
├── .claude-plugin/plugin.json     # Plugin manifest
├── .mcp.json.example              # MCP server config template
├── scripts/
│   ├── demo-e2e.ts               # Full E2E demo on X Layer
│   └── test-ai.ts               # AI provider connectivity test
│
├── docker-compose.yml
├── turbo.json
└── package.json
```

## X Layer Integration

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 196 | 1952 |
| RPC | `https://rpc.xlayer.tech` | `https://testrpc.xlayer.tech` |
| Explorer | [oklink.com/xlayer](https://www.oklink.com/xlayer) | [oklink.com/xlayer-test](https://www.oklink.com/xlayer-test) |
| Gas | OKB (~$0.0001/tx) | OKB (faucet: [okx.com/xlayer/faucet](https://www.okx.com/xlayer/faucet)) |
| USDC | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` | - |

## API Endpoints

### Portfolio Manager (port 3000)
- `POST /strategy` - Set trading strategy (risk tolerance, position size, preferred tokens)
- `GET /portfolio` - Get portfolio state (positions, P&L, agent statuses)
- `POST /orchestrate/react` - Run one ReAct cycle (LLM-driven tool-use loop)
- `GET /reasoning/latest` - Get latest ReAct reasoning trace
- `POST /orchestrate/start` - Start autonomous trading loop
- `POST /orchestrate/stop` - Stop trading loop
- `POST /orchestrate/once` - Execute one orchestration cycle (legacy pipeline)
- `GET /agents` - Agent statuses with on-chain data
- WebSocket `/ws` - Real-time updates (signals, trades, payments, tool calls, reasoning)

### Alpha Scout (port 3001) - x402 gated
- `GET /signals/latest` - Latest trading signals ($0.001 USDC)
- `GET /signals/arbitrage` - Cross-DEX arbitrage signals ($0.005 USDC)
- `GET /health` - Health check (free)
- `GET /status` - Agent status (free)

### Risk Oracle (port 3002) - x402 gated
- `POST /assess/trade` - Risk assessment for a signal ($0.002 USDC)
- `GET /metrics/volatility/:token` - Token volatility data ($0.001 USDC)
- `GET /health` - Health check (free)

### Trade Executor (port 3003) - API key protected
- `POST /execute/swap` - Execute DEX swap via OnchainOS
- `GET /status/:txHash` - Transaction confirmation status

## AI Provider Configuration

SwarmMind supports multiple AI providers. Set in `.env`:

```bash
# Choose: anthropic | openai | deepseek | openrouter
AI_PROVIDER=openai

# API key for your chosen provider
OPENAI_API_KEY=your_key_here

# Optional: override model
AI_MODEL=gpt-4o-mini

# Optional: custom relay/proxy endpoint
AI_BASE_URL=https://api.your-relay.com
```

Default models: Claude Haiku 4.5 (anthropic), GPT-4o-mini (openai), DeepSeek Chat (deepseek).

## MCP Server

SwarmMind exposes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server so any MCP-compatible client (Claude Code, Cursor, etc.) can interact with the agent swarm.

### Setup

```bash
# Copy config template
cp .mcp.json.example .mcp.json

# Start agents first
npm run dev

# MCP server connects to running agents via HTTP
```

**`.mcp.json`** config:
```json
{
  "mcpServers": {
    "swarmmind": {
      "command": "npx",
      "args": ["ts-node", "packages/mcp-server/src/index.ts"],
      "env": {
        "PORTFOLIO_MANAGER_URL": "http://localhost:3000",
        "ALPHA_SCOUT_URL": "http://localhost:3001",
        "RISK_ORACLE_URL": "http://localhost:3002",
        "TRADE_EXECUTOR_URL": "http://localhost:3003"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `get_signals` | Fetch latest trading signals from Alpha Scout |
| `assess_risk` | Assess trade risk via Risk Oracle |
| `execute_trade` | Execute trade via Trade Executor |
| `get_portfolio` | Get current portfolio state |
| `run_cycle` | Run one full ReAct orchestration cycle |

### Resources

| URI | Description |
|-----|-------------|
| `swarmmind://agents` | All registered agents and their status |
| `swarmmind://portfolio` | Current portfolio state |
| `swarmmind://reasoning` | Latest ReAct reasoning trace |

## CLI

```bash
# Get latest trading signals
npx swarmmind signals

# Arbitrage signals only
npx swarmmind signals --arbitrage

# Assess risk for a signal
npx swarmmind risk <signalId>

# Execute a trade
npx swarmmind trade <signalId> -a 100

# View portfolio
npx swarmmind portfolio

# List registered agents
npx swarmmind agents

# Run one ReAct orchestration cycle
npx swarmmind orchestrate

# Start/stop continuous orchestration
npx swarmmind orchestrate --start
npx swarmmind orchestrate --stop

# JSON output for scripting
npx swarmmind signals --json
```

## Claude Code Plugin (SKILL.md)

SwarmMind ships as a Claude Code plugin with 4 discoverable skills:

| Skill | Description |
|-------|-------------|
| `swarm-orchestrate` | Run autonomous DeFi intelligence cycles |
| `swarm-signals` | Get real-time trading signals from Alpha Scout |
| `swarm-risk` | Assess trade risk via Risk Oracle |
| `swarm-trade` | Execute trades via Trade Executor |

### Usage

Copy `.claude-plugin/` and `skills/` to your project, or reference the repo directly. Skills are compatible with [onchainos-skills](https://github.com/nicktherein/onchainos-skills) and can complement `dex-signal`, `dex-swap`, and `wallet-portfolio` skills.

## License

MIT
