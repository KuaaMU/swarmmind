# Incident Response Checklist

> Use this document for any production incident or near-miss.  
> Fill in each section as you work through the incident.

---

## Incident Metadata

| Field | Value |
|-------|-------|
| Incident ID | INC-YYYY-MM-DD-NNN |
| Severity | P0 / P1 / P2 / P3 |
| Reported at | YYYY-MM-DD HH:MM UTC |
| Detected by | <person or monitor> |
| Incident commander | <name> |
| Status | Active / Mitigated / Resolved |

---

## Phase 1 — Detect & Triage (< 5 min)

- [ ] Confirm the incident is real (not a false alarm or test traffic).
- [ ] Determine severity:
  - **P0** — Total service outage or active financial loss.
  - **P1** — Major feature unavailable or high error rate (> 10%).
  - **P2** — Partial degradation; workaround available.
  - **P3** — Minor issue; no immediate user impact.
- [ ] Notify the on-call engineer and tech lead.
- [ ] Create an incident Slack thread / GitHub issue with the incident ID.

---

## Phase 2 — Contain (< 15 min)

- [ ] Identify the affected service(s): agents / contracts / dashboard / payments.
- [ ] Determine blast radius: which users / transactions are affected.
- [ ] Apply immediate mitigation (pause contract, restart agent, disable endpoint).
- [ ] Capture relevant logs and metrics before they rotate.

```bash
# Example: capture agent logs
docker-compose logs --tail=200 alpha-scout > /tmp/incident-alpha-scout.log
```

---

## Phase 3 — Diagnose (< 30 min)

- [ ] Identify the root cause (code change, config change, external dependency, infrastructure).
- [ ] Identify the triggering event (deploy, traffic spike, data anomaly).
- [ ] Confirm the fix hypothesis before applying.

Root cause hypothesis:
```
<describe>
```

---

## Phase 4 — Resolve

- [ ] Apply the fix (or execute rollback per [rollback.md](./rollback.md)).
- [ ] Verify the fix in production (smoke test, metric recovery).
- [ ] Confirm no secondary failures.
- [ ] Update the incident status to "Resolved".

Resolution summary:
```
<what was done>
```

---

## Phase 5 — Post-Incident (within 48 h)

- [ ] Write a post-mortem document and link it to this incident.
- [ ] Identify contributing factors (process, tooling, knowledge gap).
- [ ] Define action items with owners and due dates:

| Action | Owner | Due date |
|--------|-------|----------|
| | | |

- [ ] Add a regression test.
- [ ] Update runbooks if a gap was identified.
- [ ] Share learnings with the team.

---

## Communication Template

```
[Incident Update — INC-YYYY-MM-DD-NNN]
Status: <Active / Mitigated / Resolved>
Impact: <what is affected>
Current action: <what we are doing>
ETA to resolution: <time or "unknown">
Next update in: <15 min / 30 min / 1 h>
```
