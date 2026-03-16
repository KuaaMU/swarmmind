# Self-Audit Template

> Use this checklist **before every PR, status report, or stakeholder update**.  
> Copy and fill in each section. Do not skip items — mark N/A with a reason.

---

## 1. Changes Made (已做了哪些改动)

List every file or component modified, and what was changed:

```
- [ ] <file or component>: <what changed and why>
- [ ] <file or component>: <what changed and why>
```

---

## 2. Problems Encountered (遇到了哪些问题)

List every obstacle, uncertainty, or unexpected finding during this work:

```
- [ ] Problem: <description>
      Severity: [Critical / High / Medium / Low]
      Affected area: <code path, service, or user flow>
```

---

## 3. Resolution of Each Problem (每个问题的解决结果)

For each problem listed in section 2, provide the outcome:

```
- [ ] Problem #1 → Status: [Resolved / Mitigated / Open / Deferred]
      Resolution: <what was done or why it was deferred>
      Evidence: <test output, PR link, log snippet>
```

---

## 4. Quality Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| Lint | ✅ / ❌ / N/A | |
| Typecheck | ✅ / ❌ / N/A | |
| Unit tests | ✅ / ❌ / N/A | |
| Build | ✅ / ❌ / N/A | |
| Manual smoke test | ✅ / ❌ / N/A | |

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| <risk> | Low/Med/High | Low/Med/High | <mitigation> |

---

## 6. Rollback Plan

If this change needs to be reverted:

- **Trigger condition:** <describe when rollback should be initiated>
- **Rollback steps:** See [`docs/runbooks/rollback.md`](../runbooks/rollback.md)
- **Data migration rollback required?** Yes / No

---

## 7. Next Steps

List the 2–3 most important actions after this change is merged:

```
1. 
2. 
3. 
```
