# Agent 1 Evals — Requirements Analyst

| Property | Value |
|----------|-------|
| **File** | `evals/agent1-evals.ts` |
| **Evaluates** | Output of `agent-01-requirements-analyst` |
| **Layers** | Structural + Statistical (LLM-as-Judge handled by `eval-runner.ts`) |
| **Exports** | `runAgent1StructuralEval()`, `runAgent1StatisticalEval()` |

---

## What Agent 1 Produces

Agent 1 outputs a JSON requirements brief with this top-level shape:

```json
{
  "application": "InvenTree",
  "version_assumptions": "...",
  "functional_areas": [ { "id", "area", "description", "business_rules", "api_endpoints", "ui_flows" } ],
  "non_functional_areas": [ { "id", "area", "description" } ],
  "out_of_scope": [ "..." ]
}
```

---

## Layer 1 — Structural Eval

### What It Checks

| Check | Pass Condition | Blocking? |
|-------|---------------|-----------|
| Output is a JSON object | `typeof output === "object"` | Yes |
| All top-level keys present | `application`, `version_assumptions`, `functional_areas`, `non_functional_areas`, `out_of_scope` all exist | Yes |
| `functional_areas` is an array | `Array.isArray(functional_areas)` | Yes |
| Each FA has all required fields | `id`, `area`, `description`, `business_rules`, `api_endpoints`, `ui_flows` present in every FA | Yes |
| `business_rules` is an array | Per FA: `Array.isArray(fa.business_rules)` | Yes |
| `api_endpoints` is an array | Per FA: `Array.isArray(fa.api_endpoints)` | Yes |
| `ui_flows` is an array | Per FA: `Array.isArray(fa.ui_flows)` | Yes |
| `non_functional_areas` is an array | `Array.isArray(non_functional_areas)` | Yes |
| `out_of_scope` is an array | `Array.isArray(out_of_scope)` | Yes |

### Pass / Fail Outcome

- All checks pass → `{ passed: true, issues: [] }`
- Any failure → `{ passed: false, issues: ["...description..."] }`
- A structural FAIL immediately sets `aggregateScore = 0.0` in the merged report

---

## Layer 2 — Statistical Eval

### Checks & Scoring

| # | Check | Weight | What Triggers a Warning |
|---|-------|--------|------------------------|
| 1 | **Sufficient functional areas** | Equal | `functional_areas.length < 4` |
| 2 | **≥2 business rules per FA** | Equal | Any FA has fewer than 2 rules |
| 3 | **≥1 API endpoint per FA** | Equal | Any FA has 0 endpoints listed |
| 4 | **≥3 UI flow steps per FA** | Equal | Any FA has fewer than 3 steps |
| 5 | **CRUD coverage** | Equal | Any of Create/Read/Update/Delete not found in area names |

All 5 checks are weighted equally. Score = `(checks passed) / 5`.

### CRUD Coverage Detection

The check scans `area` field values (lowercased) for these keywords:

```
create, read, update, delete
```

A missing keyword triggers: `"CRUD coverage incomplete — missing: update, delete"`

### Example Output

```json
{
  "score": 0.8,
  "details": "4/5 statistical checks passed",
  "warnings": [
    "Only 3 functional areas defined — expected ≥4 (Category CRUD, Part CRUD, Search, Auth)"
  ]
}
```

---

## LLM-as-Judge Dimensions (handled by eval-runner)

| Dimension | Weight | What the Judge Looks For |
|-----------|--------|--------------------------|
| Schema Compliance | 25% | JSON matches required schema exactly — no extra/missing fields |
| Coverage Completeness | 30% | All 4 domains present: Part Category CRUD, Part CRUD, Search & Filter, Auth |
| Business Rule Quality | 25% | Rules are specific, testable, not vague (e.g. "Name must be unique within parent category" ✅ vs "Name is important" ❌) |
| Endpoint Accuracy | 10% | Endpoints match real InvenTree REST API paths and HTTP methods |
| UI Flow Clarity | 10% | Steps are numbered, reference real UI elements, describe expected outcomes |

---

## Blocking Issues (Auto-FAIL)

The structural eval raises a blocking issue when:
- Output is not parseable JSON
- Any required top-level key is absent
- `functional_areas` is not an array

Blocking issues in the eval report prevent `PASS` or `WARN` regardless of the LLM score.

---

## Sample Eval Report

```json
{
  "agentId": "requirements-analyst",
  "evalTimestamp": "2026-09-29T19:01:00Z",
  "evalType": ["structural", "statistical", "llm-judge"],
  "overallVerdict": "PASS",
  "retryRecommended": false,
  "retryAttempt": 0,
  "dimensions": [
    { "dimension": "Schema Compliance",      "score": 1.0, "status": "PASS", "rationale": "All required fields present and correctly typed", "issues": [] },
    { "dimension": "Coverage Completeness",  "score": 1.0, "status": "PASS", "rationale": "All 4 domains covered",                          "issues": [] },
    { "dimension": "Business Rule Quality",  "score": 0.9, "status": "PASS", "rationale": "Rules are specific and testable",                "issues": [] },
    { "dimension": "Endpoint Accuracy",      "score": 1.0, "status": "PASS", "rationale": "Endpoints match InvenTree API docs",             "issues": [] },
    { "dimension": "UI Flow Clarity",        "score": 0.85,"status": "PASS", "rationale": "Steps numbered and reference real elements",     "issues": [] }
  ],
  "aggregateScore": 0.95,
  "blockingIssues": [],
  "warnings": [],
  "improvementSuggestions": [
    "Consider adding pagination behaviour as a business rule for the Read operations"
  ]
}
```

---

## Artefact

Report saved to: `agent-artifacts/logs/evals/eval-requirements-analyst.json`  
On PASS/WARN: output flows to **Agent 2 — Test Design Engineer**  
On FAIL: orchestrator injects blocking issues into retry prompt and re-runs Agent 1
