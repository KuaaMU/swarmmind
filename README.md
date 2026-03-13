# SwarmMind

**Collective AI Intelligence for the Agentic Economy on X Layer**

SwarmMind is an autonomous multi-agent DeFi intelligence network where specialized AI agents discover, assess, and execute trading opportunities on X Layer, paying each other for services via x402 micropayments.

Built for the [X Layer AI Hackathon](https://x.com/XLayerOfficial) (Phase 1: Mar 12-26, 2026).

## Architecture

```
User (Dashboard)
    |
    v
[Portfolio Manager Agent] -- orchestrator, user intent parsing
    |         |         |
    | x402    | x402    | direct call
    v         v         v
[Alpha Scout] [Risk Oracle] [Trade Executor]
  (signals)   (risk scores)  (DEX swaps)
    |              |              |
    v              v              v
  OnchainOS     OnchainOS     OnchainOS
  Market API    Market API    Trade API
                                 |
                                 v
                           X Layer DEXs
```

### Agents

| Agent | Role | Port | Payment |
|-------|------|------|---------|
| **Portfolio Manager** | Orchestrator - parses user intent, coordinates agents | 3000 | Pays others via x402 |
| **Alpha Scout** | Market intelligence - detects trading signals | 3001 | Sells signals ($0.001-$0.005 USDC) |
| **Risk Oracle** | Risk assessment - evaluates trade proposals | 3002 | Sells assessments ($0.001-$0.002 USDC) |
| **Trade Executor** | DEX execution - swaps tokens on X Layer | 3003 | Internal (API-key protected) |

### Payment Flow

All inter-agent payments use the **x402 HTTP payment protocol**:
1. Portfolio Manager requests data from Alpha Scout / Risk Oracle
2. Service returns `402 Payment Required` with USDC pricing
3. Portfolio Manager signs EIP-712 payment authorization
4. Payment settles on X Layer via USDC transfer
5. Service delivers data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity + Hardhat (X Layer Chain ID 196) |
| Backend/Agents | TypeScript + Node.js + Express |
| AI Reasoning | Claude API (Haiku 4.5 for speed) |
| DEX Trading | OKX OnchainOS Trade API |
| Market Data | OKX OnchainOS Market API |
| Payments | x402 micropayments on X Layer |
| Frontend | Next.js + TailwindCSS |
| Monorepo | Turborepo + npm workspaces |

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `AgentRegistry.sol` | On-chain agent service directory & reputation tracking |
| `AgentWalletFactory.sol` | CREATE2 deterministic wallet factory for agents |
| `PaymentSettlement.sol` | On-chain USDC payment audit trail |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- API Keys: OKX Developer Portal, Anthropic Claude
- OKB + USDC on X Layer mainnet

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/swarmmind.git
cd swarmmind

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys and wallet private keys

# Build all packages
npm run build
```

### Deploy Contracts

```bash
# Deploy to X Layer testnet
cd packages/contracts
npx hardhat run scripts/deploy.ts --network xlayerTestnet

# Deploy to X Layer mainnet
npx hardhat run scripts/deploy.ts --network xlayer
```

### Run Agents

```bash
# Development mode (runs all agents)
npm run dev

# Or run individually
cd packages/agents/alpha-scout && npm run dev
cd packages/agents/risk-oracle && npm run dev
cd packages/agents/trade-executor && npm run dev
cd packages/agents/portfolio-manager && npm run dev
```

### Run Dashboard

```bash
cd packages/dashboard
npm run dev
# Open http://localhost:3100
```

### Docker Compose

```bash
# Run all services
docker compose up -d

# View logs
docker compose logs -f
```

## Project Structure

```
swarmmind/
├── packages/
│   ├── contracts/           # Solidity smart contracts
│   ├── agents/
│   │   ├── shared/          # Common agent infrastructure
│   │   ├── alpha-scout/     # Market signal agent
│   │   ├── risk-oracle/     # Risk assessment agent
│   │   ├── trade-executor/  # DEX swap agent
│   │   └── portfolio-manager/ # Orchestrator agent
│   └── dashboard/           # Next.js frontend
├── docker-compose.yml
├── turbo.json
└── package.json
```

## X Layer Integration

- **Chain ID**: 196 (mainnet) / 195 (testnet)
- **RPC**: `https://rpc.xlayer.tech`
- **Explorer**: `https://www.oklink.com/xlayer`
- **USDC**: `0x74b7F16337b8972027F6196A17a631aC6dE26d22`
- All on-chain transactions use OKB for gas (~$0.0001/tx)
- DEX swaps via OKX OnchainOS aggregator

## API Endpoints

### Portfolio Manager (port 3000)
- `POST /strategy` - Set trading strategy
- `GET /portfolio` - Get portfolio state
- `POST /orchestrate/start` - Start auto-trading
- `POST /orchestrate/stop` - Stop auto-trading
- `POST /orchestrate/once` - Run one cycle
- `GET /agents` - Agent statuses
- WebSocket for real-time updates

### Alpha Scout (port 3001) - x402 gated
- `GET /signals/latest` - Latest signals ($0.001)
- `GET /signals/arbitrage` - Arbitrage signals ($0.005)

### Risk Oracle (port 3002) - x402 gated
- `POST /assess/trade` - Risk assessment ($0.002)
- `GET /metrics/volatility/:token` - Volatility data ($0.001)

### Trade Executor (port 3003) - API key protected
- `POST /execute/swap` - Execute DEX swap
- `GET /status/:txHash` - Transaction status

## License

MIT
