# Status Report Template

> Use this template for every stakeholder update, sprint review, or async progress report.  
> Always complete the [self-audit checklist](./workflow/self-audit-template.md) before filing this report.

---

## Report Metadata

| Field | Value |
|-------|-------|
| Report ID | SR-YYYY-MM-DD-NNN <!-- NNN = sequential number: 001, 002, … --> |
| Period covered | YYYY-MM-DD → YYYY-MM-DD |
| Author | <name> |
| Audience | <team / stakeholder> |
| Filed at | YYYY-MM-DD HH:MM UTC |

---

## 1. Changes Made (已改动)

> List what was delivered in this period. Link to PRs, commits, or deployed artifacts.

| Item | Type | PR / Commit | Status |
|------|------|------------|--------|
| <description> | feat / fix / chore / docs | #NNN | Merged / In Review / Deployed |

---

## 2. Problems Encountered (问题)

> Be specific. Describe what blocked progress or introduced risk.

| # | Problem | Severity | Area |
|---|---------|---------|------|
| 1 | <description> | Critical / High / Medium / Low | <area> |

---

## 3. Resolution of Each Problem (解决结果)

| # | Problem | Status | Resolution |
|---|---------|--------|-----------|
| 1 | <ref to problem #1> | Resolved / Mitigated / Open | <what was done or why deferred> |

---

## 4. Metrics & Quality Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| Lint | ✅ / ❌ | |
| Typecheck | ✅ / ❌ | |
| Unit tests | ✅ / ❌ | Pass count: |
| Build | ✅ / ❌ | |

---

## 5. Risk Register Update

| Risk | Likelihood | Impact | Status | Mitigation |
|------|-----------|--------|--------|-----------|
| <risk> | Low/Med/High | Low/Med/High | Open/Closed | <mitigation> |

---

## 6. Next Steps (下一步)

> The 2–3 highest-priority items for the next period.

1. 
2. 
3. 

---

## 7. Decisions Needed

> Anything that requires stakeholder input before work can continue.

- [ ] <decision needed from whom by when>
