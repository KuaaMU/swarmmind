# SwarmMind v1 – Planning Bootstrap

This document covers the **v1 planning bootstrap** implementation (Tasks 01–04).
See the root [README.md](../README.md) for the full project overview.

---

## Tasks Implemented

| # | Task | Package(s) |
|---|------|-----------|
| 01 | Monorepo/workspace structure | root `package.json`, `turbo.json` |
| 02 | Shared protocol types + Zod schemas | `packages/agents/shared` |
| 03 | RiskAgent / LiquidityAgent demo | `packages/agents/liquidity-agent` |
| 04 | Consensus engine | `packages/consensus` |

---

## Task 01 – Monorepo Structure

The repository uses **npm workspaces** + **Turborepo** for task orchestration.

```
packages/
  agents/
    shared/          – @swarmmind/shared   (types, schemas, AI client, OKX APIs)
    alpha-scout/     – @swarmmind/alpha-scout
    risk-oracle/     – @swarmmind/risk-oracle
    liquidity-agent/ – @swarmmind/liquidity-agent  ← NEW
    trade-executor/  – @swarmmind/trade-executor
    portfolio-manager/ – @swarmmind/portfolio-manager
  consensus/         – @swarmmind/consensus          ← NEW
  contracts/         – @swarmmind/contracts  (Solidity / Hardhat)
  dashboard/         – @swarmmind/dashboard  (Next.js)
```

Build all TypeScript packages (excluding contracts & dashboard):

```bash
npx turbo run build --filter='!@swarmmind/contracts' --filter='!@swarmmind/dashboard'
```

---

## Task 02 – Shared Protocol Types + Zod Schemas

**File:** `packages/agents/shared/src/schemas.ts`

Every core data structure is defined as a **Zod schema**, from which TypeScript
types are derived.  This gives us:

- Runtime validation at agent boundaries
- Auto-generated TypeScript types (single source of truth)
- Composable `ApiResponseSchema<T>` for typed API responses

### New types added

| Type | Description |
|------|-------------|
| `LiquidityPool` | AMM pool snapshot (reserves, TVL, volume, APY, utilization) |
| `LiquidityAssessment` | Liquidity score + recommendation (DEEP/ADEQUATE/SHALLOW/AVOID) |
| `AgentProposal` | A proposal submitted by an agent to a consensus round |
| `ConsensusResult` | Final consensus output with commit hash and challenge metadata |

### Usage

```typescript
import { TradingSignalSchema, AgentProposalSchema } from "@swarmmind/shared";

// Parse & validate at runtime:
const signal = TradingSignalSchema.parse(rawInput);

// Derive type:
import type { AgentProposal } from "@swarmmind/shared";
```

---

## Task 03 – LiquidityAgent Demo

**Package:** `packages/agents/liquidity-agent`

The `LiquidityAgent` assesses DeFi pool liquidity health without requiring an
AI call for the core score (fast, deterministic).  It uses the AMM
constant-product price-impact formula to estimate the slippage of a $10k trade:

```
priceImpact (bps) ≈ tradeSize / (2 × TVL) × 10,000
```

Scoring thresholds are configurable:

```typescript
import { LiquidityAgent } from "@swarmmind/liquidity-agent";

const agent = new LiquidityAgent({
  minTvlUsd: 100_000,
  deepImpactBps: 10,       // < 10 bps → DEEP
  adequateImpactBps: 50,   // 10–50 bps → ADEQUATE
});

const assessment = agent.assess(poolSnapshot);
// { liquidityScore: 8, priceImpactBps: 5, recommendation: "DEEP", ... }

// For consensus participation:
const { assessment, proposal } = agent.assessAndPropose(poolSnapshot);
```

### RiskAgent (existing) + LiquidityAgent integration

Both agents emit `AgentProposal` objects that can be passed directly into the
`ConsensusEngine` (see Task 04).

---

## Task 04 – Consensus Engine

**Package:** `packages/consensus`

Implements the **CRCN (Challenge-Responsive Consensus Network)** model:

### Algorithm

```
Proposal Layer  →  agents emit AgentProposal (claim + confidence + evidence)
Consensus Layer →  weighted voting + correlation penalty
Commit Layer    →  SHA-256 commitHash for on-chain anchoring
Challenge Layer →  configurable challenge window (default 24 h)
```

### Correlation Penalty

When `k` agents of the *same role* submit the *same claim*, each successive
agent receives a damped weight multiplier:

```
multiplier_k = 1 / (1 + correlationDecay × k)   (k = 0, 1, 2, …)
```

This prevents Sybil attacks where many same-role agents flood a claim.

### Reputation Registry

A lightweight in-memory `ReputationRegistry` assigns domain-specific weights
via **Exponentially Weighted Moving Average (EWMA)**:

```
weight_new = weight_old × (1 − α) + outcomeScore × α
```

### Usage

```typescript
import { ConsensusEngine, ReputationRegistry } from "@swarmmind/consensus";

const rep = new ReputationRegistry(1.0);
rep.update("risk-agent-1", "risk", 1.8, 0.3); // trusted agent

const engine = new ConsensusEngine(rep, {
  correlationDecay: 0.5,
  quorumThreshold: 0.5,
  challengeWindowMs: 86_400_000, // 24h
});

const result = engine.run("round-42", proposals, "risk");
// {
//   finalClaim: "REJECT",
//   weightedScore: 0.82,
//   commitHash: "a3f1...",
//   challengeOpen: true,
//   challengeExpiresAt: <timestamp>,
//   ...
// }
```

### On-chain Commit

The `commitHash` field is a **SHA-256** of `roundId :: finalClaim :: weightedScore`.
This can be anchored on-chain cheaply.  Anyone can reproduce the hash from the
off-chain proof bundle and submit a challenge during the window.

---

## Running Tests

```bash
# All TS packages
npx turbo run test --filter='!@swarmmind/contracts' --filter='!@swarmmind/dashboard'

# Specific package
npx turbo run test --filter='@swarmmind/consensus'
npx turbo run test --filter='@swarmmind/liquidity-agent'
npx turbo run test --filter='@swarmmind/shared'
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Agents Layer                              │
│                                                                  │
│  AlphaScout  RiskOracle  LiquidityAgent  TradeExecutor  …       │
│       │           │            │               │                 │
│       └───────────┴────────────┘               │                 │
│                   │ AgentProposal[]             │                 │
│           ┌───────▼───────┐                    │                 │
│           │ ConsensusEngine│                   │                 │
│           │  - weighted    │                   │                 │
│           │  - corr-penalty│                   │                 │
│           └───────┬───────┘                    │                 │
│                   │ ConsensusResult             │                 │
│           ┌───────▼───────────────────────┐    │                 │
│           │ PortfolioManager              │────┘                 │
│           └───────┬───────────────────────┘                      │
│                   │ commitHash (on-chain anchor)                  │
│           ┌───────▼───────┐                                      │
│           │  SmartContracts│ (challenge / slash / settle)        │
│           └───────────────┘                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## KPIs (v1 baseline targets)

| Metric | Target |
|--------|--------|
| Consensus round latency | < 500 ms (local, no AI call) |
| Schema validation coverage | 100 % of agent I/O boundaries |
| Test coverage (new packages) | ≥ 90 % statement coverage |
| TypeScript strict compliance | zero `any`, zero errors |
| Correlation penalty reduces Sybil score | ≥ 30 % reduction vs unpenalised |

---

## Risk Model & Rollback Strategy

| Risk | Mitigation | Rollback |
|------|-----------|---------|
| Consensus quorum not met | Lower `quorumThreshold` in config | Revert config change |
| Sybil agents flood same claim | `correlationDecay` ≥ 0.5 | Increase `correlationDecay` |
| Poisoned proposal via bad input | Zod schema validation at entry | Auto-reject invalid proposals |
| On-chain challenge not triggered | Challenge window logging + monitoring | Extend `challengeWindowMs` |
| Package dependency loop | `@swarmmind/consensus` depends only on `@swarmmind/shared` | Strict workspace boundaries |
