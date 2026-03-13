<p align="center">
  <img src="assets/banner.png" alt="SwarmMind Banner" width="800"/>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a> | English
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-148%20passing-brightgreen" alt="Tests"/>
  <img src="https://img.shields.io/badge/contracts-3%20deployed-blue" alt="Contracts"/>
  <img src="https://img.shields.io/badge/agents-4%20autonomous-purple" alt="Agents"/>
  <img src="https://img.shields.io/badge/chain-X%20Layer%20196-orange" alt="Chain"/>
  <img src="https://img.shields.io/badge/license-MIT-gray" alt="License"/>
</p>

SwarmMind is an autonomous multi-agent DeFi intelligence network where specialized AI agents discover, assess, and execute trading opportunities on X Layer, paying each other for services via x402 micropayments.

Built for the [X Layer AI Hackathon](https://x.com/XLayerOfficial) (Phase 1: Mar 12-26, 2026).

## Why SwarmMind Wins

| Judging Criteria | How SwarmMind Delivers |
|---|---|
| **Deep AI-Agent On-Chain Integration** | 4 AI agents with dedicated wallets, on-chain registration, and autonomous decision-making |
| **Autonomous Payment Flows** | x402 HTTP micropayments between agents, settled on X Layer in USDC |
| **Multi-Agent Collaboration** | Economic incentives: Scouts sell signals, Oracles sell risk assessments, PM orchestrates |
| **Ecosystem Impact** | Reusable infrastructure: AgentRegistry, WalletFactory, PaymentSettlement contracts |
| **OKX OnchainOS** | Market API for data, Trade API for DEX swaps, all on X Layer |

## Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="SwarmMind Architecture" width="700"/>
</p>

### Agent Roles

| Agent | Role | Port | Payment |
|-------|------|------|---------|
| **Portfolio Manager** | Orchestrator - parses user intent, coordinates agents | 3000 | Pays others via x402 |
| **Alpha Scout** | Market intelligence - detects trading signals via AI | 3001 | Sells signals ($0.001-$0.005 USDC) |
| **Risk Oracle** | Risk assessment - evaluates trade proposals via AI | 3002 | Sells assessments ($0.001-$0.002 USDC) |
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
| AI Reasoning | Multi-provider (Claude, GPT, DeepSeek, OpenRouter) |
| DEX Trading | OKX OnchainOS Trade API (`/dex/aggregator`) |
| Market Data | OKX OnchainOS Market API |
| Payments | x402 HTTP protocol + direct USDC settlement |
| Frontend | Next.js + TailwindCSS + Recharts |
| Blockchain | ethers.js v6, X Layer (Chain ID 196) |
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
# All tests (148 passing)
npm test

# Or individually:
# Smart contract tests (29 tests)
cd packages/contracts && npx hardhat test

# Agent unit tests (119 tests)
# shared: 47 | alpha-scout: 8 | risk-oracle: 21 | portfolio-manager: 18 | trade-executor: 25
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
│   │   │       ├── ai/            # Multi-provider AI client
│   │   │       ├── okx/           # OnchainOS Market + Trade API
│   │   │       ├── payments/      # x402 client/server + direct payment
│   │   │       ├── wallet/        # Agent wallet (ethers.js)
│   │   │       ├── config/        # X Layer config + env validation
│   │   │       └── types.ts       # Shared TypeScript types
│   │   │
│   │   ├── alpha-scout/           # Market signal agent (port 3001)
│   │   ├── risk-oracle/           # Risk assessment agent (port 3002)
│   │   ├── trade-executor/        # DEX swap agent (port 3003)
│   │   └── portfolio-manager/     # Orchestrator agent (port 3000)
│   │
│   └── dashboard/                 # Next.js frontend
│
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
- `POST /orchestrate/start` - Start autonomous trading loop
- `POST /orchestrate/stop` - Stop trading loop
- `POST /orchestrate/once` - Execute one orchestration cycle
- `GET /agents` - Agent statuses with on-chain data
- WebSocket `/ws` - Real-time updates (signals, trades, payments)

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

## License

MIT
