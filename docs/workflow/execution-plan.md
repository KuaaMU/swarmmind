# Execution Plan — SwarmMind

> Version: 1.0  
> Status: Active  
> Owner: Engineering Lead

---

## Overview

This document defines the engineering execution plan for the SwarmMind project. It establishes the cadence, branching model, quality gates, and iterative delivery process to ensure every change is traceable, reviewable, and reversible.

---

## 1. Branching Strategy

| Branch | Purpose | Merge Target |
|--------|---------|-------------|
| `main` | Production-ready code; protected | — |
| `feat/<scope>-<description>` | New features | `main` via PR |
| `fix/<scope>-<description>` | Bug fixes | `main` via PR |
| `chore/<description>` | Tooling, CI, docs | `main` via PR |
| `hotfix/<description>` | Critical production patches | `main` direct |

**Rules:**
- `main` requires at least one approved review before merge.
- Direct pushes to `main` are forbidden except for hotfixes.
- Feature branches must be rebased or merged from `main` before opening a PR.
- Branch names must be lowercase and use hyphens.

---

## 2. PR Granularity & Commit Convention

### PR Granularity
- One PR = one logical unit of change (one feature, one fix, one refactor).
- PRs must not exceed 500 lines of diff unless justified in the PR description.
- Draft PRs are encouraged for early feedback.

### Commit Message Convention (Conventional Commits)

```
<type>(<scope>): <short summary>

[optional body]
[optional footer: BREAKING CHANGE / fixes #issue]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Examples:
```
feat(agents): add CRCN consensus layer to alpha-scout
fix(contracts): correct slashing threshold in AgentRegistry
docs(workflow): add rollback runbook
ci: enable typecheck step in GitHub Actions
```

---

## 3. Quality Gates (CI)

Every PR must pass the following checks before merge:

| Gate | Tool | Command |
|------|------|---------|
| Lint | ESLint/Solhint | `npm run lint` |
| Type Check | TypeScript | `turbo run typecheck` |
| Unit Tests | Vitest / Hardhat | `npm run test` |
| Build | Turborepo | `npm run build` |

See `.github/workflows/ci.yml` for the automated pipeline.

---

## 4. Release Cadence

- **Sprint:** 1-week cycles.
- **Release tag format:** `v<major>.<minor>.<patch>` (SemVer).
- **Changelog:** Updated in `CHANGELOG.md` on every release.
- **Deployment:** Manual trigger after tag creation (automated deployment is a planned future step).

---

## 5. Risk & Rollback

All rollback procedures are documented in [`docs/runbooks/rollback.md`](../runbooks/rollback.md).  
Incident response procedures are in [`docs/runbooks/incident-checklist.md`](../runbooks/incident-checklist.md).

---

## 6. Self-Audit Before Every Report

Before raising a PR, creating a status report, or requesting a review, the author **must** complete the self-audit checklist defined in [`docs/workflow/self-audit-template.md`](./self-audit-template.md).

---

## 7. Iteration Roadmap (Next 3 Sprints)

| Sprint | Goal | Deliverables |
|--------|------|-------------|
| 1 | Workflow bootstrap | This plan, CI pipeline, PR template, rollback runbook |
| 2 | Agent consensus layer (CRCN Phase 1) | Weighted voting + domain reputation + correlation penalty |
| 3 | On-chain commit layer | Commit/challenge contract + evidence pointer enforcement |
