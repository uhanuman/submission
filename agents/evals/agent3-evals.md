# Agent 3 Evals — API Automation Engineer

| Property | Value |
|----------|-------|
| **File** | `evals/agent3-evals.ts` |
| **Evaluates** | Output of `agent-03-api-automation-engineer` |
| **Layers** | Structural + Statistical (LLM-as-Judge handled by `eval-runner.ts`) |
| **Exports** | `runAgent3StructuralEval()`, `runAgent3StatisticalEval()` |
| **Context Input** | Comma-separated list of P0 API test IDs (passed to LLM judge for coverage check) |

---

## What Agent 3 Produces

Agent 3 outputs a JSON envelope containing the full content of every generated file:

```json
{
  "files": [
    { "path": "helpers/api-client.ts",      "content": "..." },
    { "path": "tests/part-create.api.spec.ts", "content": "..." },
    { "path": "playwright.config.ts",        "content": "..." },
    { "path": "package.json",               "content": "..." },
    { "path": ".env.example",               "content": "..." }
  ]
}
```

---

## Layer 1 — Structural Eval

### What It Checks

| Check | Pass Condition | Blocking? |
|-------|---------------|-----------|
| Output is a JSON object | `typeof output === "object"` | Yes |
| `files` is an array | `Array.isArray(output.files)` | Yes |
| Every file has a non-empty `path` | `typeof path === "string" && path.trim() !== ""` | Yes |
| Every file has non-empty `content` | `typeof content === "string" && content.trim() !== ""` | Yes |

---

## Layer 2 — Statistical Eval

### Checks & Scoring (7 checks, equally weighted)

| # | Check | Pass Condition | Warning Raised On Fail |
|---|-------|---------------|------------------------|
| 1 | **Required files present** | `helpers/api-client.ts`, `playwright.config.ts`, `package.json`, `.env.example` all exist | `"Missing required files: <list>"` |
| 2 | **Spec files exist** | At least 1 file with path containing `.api.spec.ts` | `"No .api.spec.ts files found in generated output"` |
| 3 | **No hardcoded secrets** | None of the 4 secret patterns match in any file | `"SECURITY: Hardcoded secrets found in N files"` |
| 4 | **process.env usage** | All content contains `process.env.INVENTREE_BASE_URL` AND `process.env.INVENTREE_API_TOKEN` | `"process.env.INVENTREE_BASE_URL or INVENTREE_API_TOKEN not found"` |
| 5 | **Cleanup hooks present** | Content contains `afterEach` or `afterAll` | `"No afterEach/afterAll cleanup hooks found"` |
| 6 | **Status code assertions** | Content contains `expect(response.status())` or `expect(response.status).toBe` | `"No status code assertions found"` |
| 7 | **Response body assertions** | Content contains `toMatchObject` or `response.json()` | `"No response body assertions found"` |

---

## Hardcoded Secret Detection Patterns

The statistical eval scans every generated file's content against these regex patterns:

| Pattern | Detects |
|---------|---------|
| `/password\s*=\s*['"][^'"]+['"]/gi` | Hardcoded password string |
| `/token\s*=\s*['"][a-zA-Z0-9_-]{20,}['"]/gi` | Hardcoded API token |
| `/localhost:\d{4}/g` | Hardcoded base URL (localhost) |
| `/127\.0\.0\.1/g` | Hardcoded IP address |
| `/Authorization:\s*Token\s+[a-zA-Z0-9_-]{10,}/gi` | Hardcoded auth header value |

Any match → **blocking issue** is raised (security violations are always blocking).

---

## Required Files Checklist

```
automation/api/
├── helpers/api-client.ts       ← REQUIRED (shared ApiClient class)
├── playwright.config.ts         ← REQUIRED (test runner configuration)
├── package.json                 ← REQUIRED (dependency manifest)
├── .env.example                 ← REQUIRED (env var documentation)
└── tests/
    └── *.api.spec.ts            ← REQUIRED (at least 1 spec file)
```

---

## LLM-as-Judge Dimensions (handled by eval-runner)

| Dimension | Weight | What the Judge Looks For |
|-----------|--------|--------------------------|
| Schema Compliance | 10% | `files` array is valid; every entry has `path` and `content` |
| Required Files | 20% | All 5 mandatory files present with meaningful content |
| Code Correctness | 25% | TypeScript is syntactically valid; imports reference real packages; test.describe/test structure correct |
| Security | 20% | Zero hardcoded credentials; all env vars read via `process.env` |
| Test Coverage | 15% | Every P0 API test ID (injected as context) has a corresponding `test()` block |
| Best Practices | 10% | `afterEach`/`afterAll` cleanup; `test.step()` used; JSDoc on helpers |

**Ground truth for coverage:** comma-separated P0 API test IDs from Agent 2 are injected into the judge prompt.

---

## Blocking Issues (Auto-FAIL)

| Condition | Blocking Issue Raised |
|-----------|----------------------|
| Output not a JSON object | Structural fail, score = 0 |
| `files` not an array | `'"files" property must be an array'` |
| Any file has empty `content` | `'files[N] missing or empty "content"'` |
| Hardcoded credential found | `'SECURITY: Hardcoded secrets found in "path": found "..."'` |

---

## Sample Eval Report

```json
{
  "agentId": "api-automation-engineer",
  "evalTimestamp": "2026-09-29T19:05:00Z",
  "evalType": ["structural", "statistical", "llm-judge"],
  "overallVerdict": "PASS",
  "retryRecommended": false,
  "retryAttempt": 0,
  "dimensions": [
    { "dimension": "Schema Compliance", "score": 1.0,  "status": "PASS", "rationale": "Files array valid, all entries have path and content", "issues": [] },
    { "dimension": "Required Files",    "score": 1.0,  "status": "PASS", "rationale": "All 5 required files present",                         "issues": [] },
    { "dimension": "Code Correctness",  "score": 0.9,  "status": "PASS", "rationale": "TypeScript valid, standard @playwright/test imports",  "issues": [] },
    { "dimension": "Security",          "score": 1.0,  "status": "PASS", "rationale": "All config from process.env, no hardcoded values",     "issues": [] },
    { "dimension": "Test Coverage",     "score": 0.92, "status": "PASS", "rationale": "11/12 P0 API cases have spec blocks",                  "issues": ["TC-API-009 (PATCH auth fail) has no spec block"] },
    { "dimension": "Best Practices",    "score": 0.85, "status": "PASS", "rationale": "afterEach present, test.step used, JSDoc on ApiClient","issues": [] }
  ],
  "aggregateScore": 0.93,
  "blockingIssues": [],
  "warnings": ["TC-API-009 (PATCH auth failure) has no corresponding test block"],
  "improvementSuggestions": [
    "Add test for TC-API-009: PATCH /api/part/{id}/ without token → expect 401",
    "Replace 'any' type on lines 34, 67 of api-client.ts with explicit PartResponse interface"
  ]
}
```

---

## Artefact

Report saved to: `agent-artifacts/logs/evals/eval-api-automation-engineer.json`  
Generated automation files written to: `automation/api/`  
On PASS/WARN: file paths flow to **Agent 5 — QA Lead Reviewer**  
On FAIL: orchestrator builds self-correction prompt specifying missing files, security violations, or missing test blocks
