# Rollback Runbook

> Severity: Any  
> Audience: On-call engineer, tech lead  
> Related: [Incident Checklist](./incident-checklist.md)

---

## When to Use This Runbook

Initiate a rollback when any of the following is true:

- A deployed change causes a P0/P1 incident (service down, data corruption, payment failure).
- CI gate passes but production smoke test fails.
- An agent is producing incorrect signals that would cause real financial loss.
- A smart contract deployment is confirmed to have a critical bug.

---

## 1. Code Rollback (Application / API)

### Step 1 — Identify the bad commit

```bash
git log --oneline -20
```

Note the last known-good commit SHA (e.g., `abc1234`).

### Step 2 — Revert via Git (preferred for traceability)

```bash
git checkout main
git revert <bad-commit-sha> --no-edit
git push origin main
```

This creates a new revert commit, preserving full history.

### Step 3 — Force rollback (emergency only)

If the revert is not fast enough and you need to roll back immediately:

```bash
git checkout main
git reset --hard <last-good-sha>
git push --force-with-lease origin main
```

> ⚠️ `--force-with-lease` prevents overwriting commits made by others after your last fetch.

### Step 4 — Redeploy

Trigger the deployment pipeline for the reverted commit. Verify that the service is healthy.

---

## 2. Smart Contract Rollback

Smart contracts **cannot** be reverted on-chain. Instead:

### Option A — Pause Contract (if pause is implemented)

```solidity
// AgentRegistry, PaymentSettlement support Pausable
pause()  // called by owner/admin wallet
```

### Option B — Upgrade to Previous Version (if upgradeable proxy)

1. Confirm the previous implementation address from deployment logs.
2. Call `upgradeTo(<previous-implementation-address>)` from the proxy admin wallet.
3. Verify state consistency.

### Option C — Deploy New Version + Redirect

1. Deploy a corrected contract.
2. Update all agent configs to point to the new address.
3. Announce migration via governance or admin event log.

> Contract rollback decisions must be reviewed by at least two engineers before execution.

---

## 3. Database / State Rollback

Currently, SwarmMind does not use a persistent relational database. Agent state is held in-memory and reset on restart. If a persistent store is added in future, this section must be updated.

---

## 4. Configuration Rollback

Agent environment variables are stored in `.env` files (local) or secrets manager (production).

1. Identify which environment variable change caused the issue.
2. Restore the previous value from the secrets manager history or `.env.example` baseline.
3. Restart affected agents.

---

## 5. Post-Rollback Actions

- [ ] Confirm service is healthy (API responds, agents register, payments settle).
- [ ] File an incident report using the [Incident Checklist](./incident-checklist.md).
- [ ] Open a post-mortem issue in GitHub with label `post-mortem`.
- [ ] Add a regression test that would have caught the bug.
- [ ] Update this runbook if the rollback procedure revealed a gap.
