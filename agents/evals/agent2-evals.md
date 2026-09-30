# Agent 2 Evals — Test Design Engineer

| Property | Value |
|----------|-------|
| **File** | `evals/agent2-evals.ts` |
| **Evaluates** | Output of `agent-02-test-design-engineer` |
| **Layers** | Structural + Statistical (LLM-as-Judge handled by `eval-runner.ts`) |
| **Exports** | `runAgent2StructuralEval()`, `runAgent2StatisticalEval()` |
| **Context Input** | Requirements brief from Agent 1 (passed to LLM judge for traceability check) |

---

## What Agent 2 Produces

Agent 2 outputs a test catalogue JSON with this shape:

```json
{
  "test_suite": {
    "name": "InvenTree Part CRUD Test Suite",
    "total_cases": 60,
    "test_cases": [
      {
        "id": "TC-API-001",
        "type": "API",
        "functional_area_ref": "FA-003",
        "title": "Create Part — Happy Path",
        "priority": "P0",
        "preconditions": ["Auth token obtained"],
        "steps": [ { "step_number": 1, "action": "...", "expected_result": "..." } ],
        "test_data": { "name": "Resistor 10K", "category": 1 },
        "tags": ["smoke", "regression", "auth"]
      }
    ]
  }
}
```

---

## Layer 1 — Structural Eval

### What It Checks

| Check | Pass Condition | Blocking? |
|-------|---------------|-----------|
| Top-level `test_suite` key exists | `"test_suite" in output` | Yes |
| `test_suite.name` is a string | `typeof name === "string"` | Yes |
| `test_suite.total_cases` is a number | `typeof total_cases === "number"` | Yes |
| `test_suite.test_cases` is an array | `Array.isArray(test_cases)` | Yes |
| Each TC has all required fields | `id`, `type`, `functional_area_ref`, `title`, `priority`, `preconditions`, `steps`, `test_data`, `tags` | Yes |
| `type` is `"API"` or `"UI"` | Exact enum match | Yes |
| `priority` is `"P0"`, `"P1"`, or `"P2"` | Exact enum match | Yes |
| Each TC has ≥1 step | `steps.length >= 1` | Yes |
| `tags` is an array | `Array.isArray(tags)` | Yes |

---

## Layer 2 — Statistical Eval

### Checks & Scoring (7 checks, equally weighted)

| # | Check | Minimum Threshold | Warning Message |
|---|-------|------------------|----------------|
| 1 | **Total API cases** | ≥ 32 (8 × 4 ops) | `"Only N API test cases — expected ≥32"` |
| 2 | **Total UI cases** | ≥ 24 (6 × 4 ops) | `"Only N UI test cases — expected ≥24"` |
| 3 | **P0 distribution** | ≥ 4 P0 API + ≥ 4 P0 UI | `"Insufficient P0 cases — API: N, UI: N"` |
| 4 | **Negative scenarios present** | ≥1 TC with tag `negative` or title containing `invalid`/`missing` | `"No negative/error test cases found"` |
| 5 | **Auth failure tests present** | ≥1 TC with tag `auth` + title containing `unauthorized` | `"No explicit authentication failure tests found"` |
| 6 | **All TCs have test_data** | `test_data` non-empty for every TC | `"N test cases have empty test_data: TC-xxx, ..."` |
| 7 | **total_cases matches array length** | `total_cases === test_cases.length` | `"total_cases (N) does not match actual array length (M)"` |

Score = `(checks passed) / 7`

### Minimum Case Counts

```
Operations: Create, Read, Update, Delete  (4)

API minimum per operation: 8
Total API minimum:         4 × 8 = 32

UI minimum per operation:  6
Total UI minimum:          4 × 6 = 24
```

---

## LLM-as-Judge Dimensions (handled by eval-runner)

| Dimension | Weight | What the Judge Looks For |
|-----------|--------|--------------------------|
| Schema Compliance | 15% | JSON matches test catalogue schema — all fields typed correctly |
| Count Adequacy | 25% | ≥8 API and ≥6 UI cases exist per CRUD operation (not just in total) |
| Scenario Diversity | 25% | Happy path, boundary edge case, negative, and auth failure all present *per functional area* |
| Traceability | 15% | Every `functional_area_ref` value matches an `id` from Agent 1's brief |
| Test Data Quality | 10% | Data is realistic (real field names, boundary values, invalid types where needed) |
| Priority Distribution | 10% | P0 assigned only to smoke/critical-path; P2 for edge/boundary cases |

**Ground truth for traceability:** the requirements brief JSON from Agent 1 is injected into the judge prompt as context.

---

## Blocking Issues (Auto-FAIL)

| Condition | Blocking Issue Raised |
|-----------|----------------------|
| `test_suite` key missing | `'Missing required top-level field: "test_suite"'` |
| `test_cases` not an array | `'"test_suite.test_cases" must be an array'` |
| Any TC has `type` ≠ `"API"` \| `"UI"` | `'test_cases[N].type must be "API" or "UI"'` |
| Any TC has `priority` ≠ P0/P1/P2 | `'test_cases[N].priority must be P0, P1, or P2'` |
| Any TC has 0 steps | `'test_cases[N] must have at least 1 step'` |

---

## Sample Eval Report

```json
{
  "agentId": "test-design-engineer",
  "evalTimestamp": "2026-09-29T19:03:00Z",
  "evalType": ["structural", "statistical", "llm-judge"],
  "overallVerdict": "WARN",
  "retryRecommended": false,
  "retryAttempt": 0,
  "dimensions": [
    { "dimension": "Schema Compliance",    "score": 1.0,  "status": "PASS", "rationale": "All fields present and typed correctly", "issues": [] },
    { "dimension": "Count Adequacy",       "score": 0.75, "status": "WARN", "rationale": "Part Delete has only 5 API cases (expected ≥8)", "issues": ["FA-006 API cases: 5, expected ≥8"] },
    { "dimension": "Scenario Diversity",   "score": 0.9,  "status": "PASS", "rationale": "Happy, boundary, negative covered. PATCH auth missing.", "issues": ["No auth failure test for PATCH /api/part/{id}/"] },
    { "dimension": "Traceability",         "score": 1.0,  "status": "PASS", "rationale": "All 60 TCs reference valid FA-xxx IDs",   "issues": [] },
    { "dimension": "Test Data Quality",    "score": 0.85, "status": "PASS", "rationale": "Data is specific and boundary-aware",      "issues": [] },
    { "dimension": "Priority Distribution","score": 1.0,  "status": "PASS", "rationale": "P0 cases exist for all 6 FAs",            "issues": [] }
  ],
  "aggregateScore": 0.77,
  "blockingIssues": [],
  "warnings": [
    "Part Delete (FA-006) has only 5 API test cases — below minimum of 8",
    "No auth failure test for PATCH endpoint"
  ],
  "improvementSuggestions": [
    "Add 3 more TC-API cases for FA-006: delete with BOM reference, delete with stock, delete with 404",
    "Add TC-API-0xx: PATCH /api/part/{id}/ without Authorization header → expect 401"
  ]
}
```

---

## Artefact

Report saved to: `agent-artifacts/logs/evals/eval-test-design-engineer.json`  
On PASS/WARN: test catalogue flows to **Agent 3** (API cases) and **Agent 4** (UI cases)  
On FAIL: orchestrator builds self-correction prompt with specific missing case requirements and retries Agent 2
