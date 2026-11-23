# Health review report template

Copy this structure into the response. Replace placeholders with real values from the review.

## Scoring

Start at **100**. Subtract per confirmed finding or evidence-backed
optimization opportunity:

| Severity | Points |
|----------|--------|
| Critical | −15 |
| High | −10 |
| Medium | −5 |
| Low | −2 |
| Info | 0 |

Floor at **0**. Round to integer. Add a one-line rationale after the score (e.g. "Two High security findings on scripts drove the score down."). Do not subtract for intentionally retained designs or unassessed checks. When review coverage is incomplete, label the score as based only on assessed evidence; it is not proof that the process is healthy.

Optional band:

| Score | Band |
|-------|------|
| 85–100 | Healthy |
| 70–84 | Needs attention |
| 50–69 | At risk |
| 0–49 | Critical |

---

```markdown
# Process health review: {ProcessName}

**Process id:** {id}  
**Reviewed:** {date}  
**Scope:** {full | area}  
**Overall health score:** {score}/100 ({band}; based on assessed evidence)

## Executive summary

{2–4 sentences: overall posture, top risks, best quick win.}

## Findings by asset

{Group findings under Process configuration, BPMN flow, Screens, Scripts,
Data Connectors, Decision Tables, Collections, PM Blocks, or Variables. Add
Sub-processes, Signals, FlowGenie, or Email subsections when relevant. Omit
empty groups and repeat the following schema for every finding.}

### {Asset area}

#### {Finding ID} — {short finding title}

- **Asset:** {name or id}
- **Assessment:** {documented violation | context-dependent optimization opportunity}
- **Severity / category:** {level} / {category}
- **Evidence:** {node IDs and sequence, control, script line, or configuration key}
- **Impact:** {observed or potential user/operational impact; qualify unmeasured risks}
- **Recommendation:** {concrete action}
- **Implementation skill:** {owning pm4-* skill}
- **Reference:** {applicable official best-practice page and relevant practice}
- **Priority:** {quick win | long-term}

## Intentionally retained designs

{List reviewed designs that remain unchanged, with asset evidence and the
reason for retaining their boundaries. Write None if there are no such designs.}

## Not assessed

| Area or check | Missing evidence | Needed to assess |
|---------------|------------------|------------------|
| {area} | {asset, configuration, or runtime data unavailable} | {next step} |

{Write None if all checks in the requested scope were assessed.}

## Quick wins

Ordered by impact vs effort. Each item: **{finding id}** — {one sentence action}.

1. …
2. …

## Long-term recommendations

Structural or cross-cutting improvements (architecture, block extraction, collection migration, env var program).

1. …
2. …

## Assets reviewed

| Type | Count | Notes |
|------|-------|-------|
| Form tasks | n | |
| Script tasks | n | |
| Screens | n | |
| Decision tables | n | |
| Data connectors | n | |
| Collections | n | |
| PM Blocks / call activities | n | |
| Sub-processes | n | |

## Out of scope

{What was not reviewed — runtime load test, unrelated processes, packages not installed, etc.}
```

---

## Writing rules

- Every finding needs **evidence**, a user or operational **impact**, an
  actionable recommendation, the owning implementation skill, and an
  applicable official best-practice reference. Use
  [best-practices.md](best-practices.md) for documented practices; if no
  official source applies to an existing health check, say so instead of
  attributing it to an unrelated page.
- Distinguish a documented violation from a context-dependent optimization
  opportunity; state the rationale for an intentionally retained design.
- Do not invent asset IDs, timings, or findings when data was not loaded:
  mark the relevant check **Not assessed** and say what is missing.
- Separate **quick wins** (hours) from **long-term** (days/weeks), linking
  each recommendation back to a finding ID.
