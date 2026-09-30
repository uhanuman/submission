# Agent 4 Evals — UI Automation Engineer

| Property | Value |
|----------|-------|
| **File** | `evals/agent4-evals.ts` |
| **Evaluates** | Output of `agent-04-ui-automation-engineer` |
| **Layers** | Structural + Statistical (LLM-as-Judge handled by `eval-runner.ts`) |
| **Exports** | `runAgent4StructuralEval()`, `runAgent4StatisticalEval()` |
| **Context Input** | Comma-separated list of P0 UI test IDs (passed to LLM judge for coverage check) |

---

## What Agent 4 Produces

Agent 4 outputs a JSON envelope containing all generated Page Object and spec files:

```json
{
  "files": [
    { "path": "pages/LoginPage.ts",             "content": "..." },
    { "path": "pages/PartsListPage.ts",          "content": "..." },
    { "path": "pages/PartDetailPage.ts",         "content": "..." },
    { "path": "pages/PartFormPage.ts",           "content": "..." },
    { "path": "helpers/fixtures.ts",             "content": "..." },
    { "path": "tests/part-create.ui.spec.ts",    "content": "..." },
    { "path": "playwright.config.ts",            "content": "..." },
    { "path": "package.json",                    "content": "..." },
    { "path": ".env.example",                    "content": "..." }
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

### Checks & Scoring (8 checks, equally weighted)

| # | Check | Pass Condition | Warning Raised On Fail |
|---|-------|---------------|------------------------|
| 1 | **Required files present** | All 8 mandatory files exist | `"Missing required files: <list>"` |
| 2 | **Page class methods** | Each page file contains all required method names | `"POM structure: <PageFile> missing method: <method>()"` |
| 3 | **Preferred locators used** | ≥3 of 5 preferred locator types appear in all content | `"Only N/5 preferred locator types found"` |
| 4 | **No fragile CSS locators** | None of 4 fragile patterns match | `"Fragile CSS locators found in: <files>"` |
| 5 | **No hardcoded credentials** | None of 4 secret patterns match | `"SECURITY: Hardcoded secrets in: <files>"` |
| 6 | **authenticatedPage fixture** | All content contains both `authenticatedPage` and `extend` | `"No shared authenticatedPage fixture found"` |
| 7 | **URL and visibility assertions** | Content contains `toHaveURL` AND (`toHaveTitle` OR `toBeVisible`) | `"No toHaveURL assertions found"` / `"No toHaveTitle/toBeVisible"` |
| 8 | **Spec files exist** | ≥1 file with path containing `.ui.spec.ts` | `"No .ui.spec.ts test files found"` |

---

## Required Files Checklist

```
automation/ui/
├── pages/
│   ├── LoginPage.ts         ← REQUIRED (POM: navigate, fillCredentials, submit)
│   ├── PartsListPage.ts     ← REQUIRED (POM: navigate, clickCreatePart, searchPart)
│   ├── PartDetailPage.ts    ← REQUIRED (POM: clickEdit, clickDelete)
│   └── PartFormPage.ts      ← REQUIRED (POM: fillName, submit, getValidationError)
├── helpers/
│   └── fixtures.ts          ← REQUIRED (authenticatedPage fixture)
├── playwright.config.ts      ← REQUIRED
├── package.json              ← REQUIRED
└── .env.example              ← REQUIRED
```

---

## Required Page Object Methods

| Page Class | Required Methods |
|------------|-----------------|
| `LoginPage.ts` | `navigate`, `fillCredentials`, `submit` |
| `PartsListPage.ts` | `navigate`, `clickCreatePart`, `searchPart` |
| `PartDetailPage.ts` | `clickEdit`, `clickDelete` |
| `PartFormPage.ts` | `fillName`, `submit`, `getValidationError` |

The check scans each page file's string content for the method names (they must appear as function definitions).

---

## Preferred vs Fragile Locators

### Preferred (should use — ≥3 of 5 required)

```typescript
page.getByRole(...)        // ✅ semantic, accessible
page.getByLabel(...)       // ✅ matches form labels
page.getByTestId(...)      // ✅ explicit test IDs
page.getByText(...)        // ✅ content-based
page.getByPlaceholder(...) // ✅ input placeholder
```

### Fragile (should NOT use)

```regex
page.locator('div.')        // bare element + class
page.locator('span.')       // bare element + class
page.locator('.class-name') // bare class selector
$('...')                    // jQuery-style
```

---

## Hardcoded Secret Detection Patterns

| Pattern | Detects |
|---------|---------|
| `/password\s*=\s*['"][^'"]+['"]/gi` | Hardcoded password |
| `/username\s*=\s*['"][^'"]{3,}['"]/gi` | Hardcoded username |
| `/localhost:\d{4}/g` | Hardcoded base URL |
| `/127\.0\.0\.1/g` | Hardcoded IP address |

Any match → **blocking issue** is raised.

---

## LLM-as-Judge Dimensions (handled by eval-runner)

| Dimension | Weight | What the Judge Looks For |
|-----------|--------|--------------------------|
| Schema Compliance | 10% | `files` array valid; every entry has `path` and `content` |
| POM Structure | 25% | All 4 page classes exist with correct method signatures and no test logic embedded |
| Locator Quality | 20% | `getByRole`/`getByLabel`/`getByTestId` used; no fragile CSS selectors |
| Security | 15% | Zero hardcoded credentials; all env vars via `process.env` |
| Test Independence | 15% | Each spec sets up data via API in `beforeEach`/`beforeAll` and cleans up in `afterEach`/`afterAll` |
| Assertion Quality | 15% | `toHaveURL`, `toHaveTitle`, `toBeVisible` used appropriately after actions |

**Ground truth for coverage:** comma-separated P0 UI test IDs from Agent 2 are injected into the judge prompt.

---

## Blocking Issues (Auto-FAIL)

| Condition | Blocking Issue Raised |
|-----------|----------------------|
| Output not a JSON object | Structural fail, score = 0 |
| `files` not an array | `'"files" property must be an array'` |
| Any file has empty `content` | `'files[N] missing or empty "content"'` |
| Hardcoded credential found | `'SECURITY: Hardcoded secrets in: "path"'` |

---

## Sample Eval Report

```json
{
  "agentId": "ui-automation-engineer",
  "evalTimestamp": "2026-09-29T19:06:00Z",
  "evalType": ["structural", "statistical", "llm-judge"],
  "overallVerdict": "PASS",
  "retryRecommended": false,
  "retryAttempt": 0,
  "dimensions": [
    { "dimension": "Schema Compliance",  "score": 1.0,  "status": "PASS", "rationale": "Files array valid, all entries populated",              "issues": [] },
    { "dimension": "POM Structure",      "score": 0.92, "status": "PASS", "rationale": "All 4 page classes present with required methods",       "issues": ["PartFormPage missing getValidationError()"] },
    { "dimension": "Locator Quality",    "score": 0.88, "status": "PASS", "rationale": "getByRole and getByLabel used throughout, no CSS found", "issues": [] },
    { "dimension": "Security",           "score": 1.0,  "status": "PASS", "rationale": "All credentials from process.env",                       "issues": [] },
    { "dimension": "Test Independence",  "score": 0.85, "status": "PASS", "rationale": "API setup/teardown in beforeEach/afterEach",             "issues": [] },
    { "dimension": "Assertion Quality",  "score": 0.9,  "status": "PASS", "rationale": "toHaveURL and toBeVisible used after navigation",        "issues": [] }
  ],
  "aggregateScore": 0.91,
  "blockingIssues": [],
  "warnings": ["PartFormPage.ts missing getValidationError() method"],
  "improvementSuggestions": [
    "Add getValidationError(fieldName: string): Promise<string> to PartFormPage — required for negative test cases",
    "Add test.slow() to multi-step CRUD workflow tests"
  ]
}
```

---

## Artefact

Report saved to: `agent-artifacts/logs/evals/eval-ui-automation-engineer.json`  
Generated automation files written to: `automation/ui/`  
On PASS/WARN: file paths flow to **Agent 5 — QA Lead Reviewer**  
On FAIL: orchestrator builds self-correction prompt specifying missing page methods, security violations, or missing test blocks
