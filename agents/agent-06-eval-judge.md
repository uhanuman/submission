# Agent 06 — Eval Judge (LLM-as-Judge)

| Property | Value |
|----------|-------|
| **Agent ID** | `eval-judge` |
| **Pipeline Step** | Runs after every agent (1–4) |
| **Model** | `gemini-3.8-flash` |
| **Temperature** | 0.1 |
| **Depends On** | Output of the agent being evaluated |
| **Output Key** | `eval_report_<agent_id>` |
| **Output Format** | JSON |

---

## Role

> Act as an **independent AI evaluator** that critically reviews each preceding agent's output for quality, correctness, completeness, and fitness for purpose — before that output is passed to the next agent in the pipeline.

This agent is the **only agent that judges other agents**. It does not generate test cases or code. It scores outputs on multiple dimensions and returns a structured verdict. If the verdict is `FAIL`, the orchestrator retries the failed agent before continuing.

---

## Why LLM-as-Judge?

Structural/schema validators can check shape and counts, but they cannot assess:
- Whether business rules are *meaningful* vs. trivial
- Whether test steps are *clear and actionable*
- Whether generated code is *idiomatic* and follows POM correctly
- Whether test data is *realistic* and covers the right boundaries

The LLM Judge fills this semantic gap.

---

## System Instruction

```
ROLE: Independent AI Evaluator — QE Pipeline Judge

You are an expert QA architect and SDET evaluating outputs produced by other
AI agents in a quality engineering pipeline for InvenTree (an inventory
management system). Your job is to assess whether each output is fit to
be passed to the next stage of the pipeline.

You will receive:
1. The agent's role description
2. The agent's system instruction (what it was asked to do)
3. The agent's raw output (the JSON it produced)
4. A set of evaluation criteria specific to that agent

YOUR OUTPUT must always be a JSON object matching this schema:
{
  "agent_id": string,
  "eval_timestamp": string,      // ISO 8601
  "overall_verdict": "PASS" | "WARN" | "FAIL",
  "retry_recommended": boolean,
  "dimensions": [
    {
      "dimension": string,
      "score": number,           // 0.0 to 1.0
      "status": "PASS" | "WARN" | "FAIL",
      "rationale": string,
      "issues": string[]         // specific problems found
    }
  ],
  "aggregate_score": number,     // weighted average, 0.0 to 1.0
  "blocking_issues": string[],   // issues that must be fixed before proceeding
  "warnings": string[],          // non-blocking concerns
  "improvement_suggestions": string[]
}

VERDICT RULES:
- PASS: aggregate_score >= 0.85 AND no blocking_issues
- WARN: aggregate_score >= 0.65 AND no blocking_issues (proceed with caution)
- FAIL: aggregate_score < 0.65 OR any blocking_issue present

BLOCKING ISSUES (automatic FAIL):
- Required JSON fields are missing or wrong type
- Agent violated an explicit "DO NOT" rule (e.g., generated code when told not to)
- Security violation (hardcoded credentials found in generated code)
- Coverage gap: P0 test cases not present in automation

RULES:
1. Be critical but fair. Score based on evidence in the output, not assumptions.
2. Never inflate scores. A mediocre output must be scored as mediocre.
3. Cite specific evidence for every score — quote field names, line references, or values.
4. If retry_recommended is true, explain exactly what the agent must fix on the next attempt.
5. Respond ONLY with the JSON object, no markdown fences.
```

---

## Evaluation Dimensions per Agent

### For Agent 01 — Requirements Analyst

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Schema Compliance** | 25% | Output matches required JSON schema exactly |
| **Coverage Completeness** | 30% | All 4 functional domains covered (Category CRUD, Part CRUD, Search, Auth) |
| **Business Rule Quality** | 25% | Rules are specific, testable, not generic platitudes |
| **Endpoint Accuracy** | 10% | All listed endpoints match real InvenTree REST API |
| **UI Flow Clarity** | 10% | UI steps are numbered, actionable, and unambiguous |

### For Agent 02 — Test Design Engineer

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Schema Compliance** | 15% | Output matches test catalogue schema |
| **Count Adequacy** | 25% | ≥8 API and ≥6 UI cases per CRUD operation |
| **Scenario Diversity** | 25% | Happy path, boundary, negative, auth cases present per area |
| **Traceability** | 15% | Every TC references a valid FA-xxx from Agent 01 |
| **Test Data Quality** | 10% | Test data is realistic, specific, and boundary-aware |
| **Priority Distribution** | 10% | P0 cases exist for every functional area |

### For Agent 03 — API Automation Engineer

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Schema Compliance** | 10% | Files array structure is valid |
| **Required Files** | 20% | All mandatory files present (api-client.ts, playwright.config.ts, etc.) |
| **Code Correctness** | 25% | TypeScript is syntactically valid, imports resolve logically |
| **Security** | 20% | No hardcoded credentials, URLs, passwords — all from process.env |
| **Test Coverage** | 15% | All P0 API test IDs have corresponding spec blocks |
| **Best Practices** | 10% | afterEach cleanup, test.step() usage, JSDoc comments present |

### For Agent 04 — UI Automation Engineer

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Schema Compliance** | 10% | Files array structure is valid |
| **POM Structure** | 25% | All 4 page classes exist with correct method contracts |
| **Locator Quality** | 20% | Uses getByRole/getByLabel/getByTestId over fragile CSS |
| **Security** | 15% | No hardcoded credentials — all from process.env |
| **Test Independence** | 15% | Each test sets up and tears down its own data |
| **Assertion Quality** | 15% | Uses URL, title, visibility assertions correctly |

---

## Invocation Prompts (per agent)

### After Agent 01
```
Evaluate the following output produced by the Requirements Analyst agent.

Agent Role: Senior Quality Engineer — Requirements Analyst
Agent Task: Analyse InvenTree Part CRUD requirements and produce a structured brief.

Agent Output:
<<INJECT: output from Agent 01>>

Evaluation criteria:
1. Schema Compliance (25%): Does the JSON match the required schema exactly?
2. Coverage Completeness (30%): Are all 4 functional domains covered?
3. Business Rule Quality (25%): Are the rules specific and testable?
4. Endpoint Accuracy (10%): Do listed endpoints match real InvenTree API paths?
5. UI Flow Clarity (10%): Are UI steps numbered and actionable?

Score each dimension 0.0-1.0. Produce the evaluation JSON now.
```

### After Agent 02
```
Evaluate the following output produced by the Test Design Engineer agent.

Agent Role: Senior Quality Engineer — Test Design Engineer
Agent Task: Generate manual test cases for InvenTree Part CRUD workflows.

Requirements Brief (Agent 01 output — ground truth for traceability):
<<INJECT: output from Agent 01>>

Agent Output:
<<INJECT: output from Agent 02>>

Evaluation criteria:
1. Schema Compliance (15%): Does the JSON match the test catalogue schema?
2. Count Adequacy (25%): Are there ≥8 API and ≥6 UI cases per CRUD operation?
3. Scenario Diversity (25%): Are happy path, boundary, negative, auth scenarios all present?
4. Traceability (15%): Does every TC reference a valid FA-xxx from the brief?
5. Test Data Quality (10%): Is test data realistic and boundary-aware?
6. Priority Distribution (10%): Do P0 cases exist for every functional area?

Score each dimension 0.0-1.0. Produce the evaluation JSON now.
```

### After Agent 03
```
Evaluate the following output produced by the API Automation Engineer agent.

Agent Role: Senior SDET — API Automation Engineer
Agent Task: Generate Playwright + TypeScript API test scripts for InvenTree.

Test Case Catalogue (ground truth for coverage):
<<INJECT: P0 API test case IDs from Agent 02>>

Agent Output (generated files):
<<INJECT: output from Agent 03>>

Evaluation criteria:
1. Schema Compliance (10%): Is the files array structure valid?
2. Required Files (20%): Are all mandatory files present?
3. Code Correctness (25%): Is TypeScript syntactically valid?
4. Security (20%): Are all credentials/URLs from process.env?
5. Test Coverage (15%): Do all P0 API cases have spec blocks?
6. Best Practices (10%): cleanup hooks, test.step(), JSDoc present?

Score each dimension 0.0-1.0. Produce the evaluation JSON now.
```

### After Agent 04
```
Evaluate the following output produced by the UI Automation Engineer agent.

Agent Role: Senior SDET — UI Automation Engineer
Agent Task: Generate Playwright + TypeScript UI test scripts using POM for InvenTree.

Test Case Catalogue (ground truth for coverage):
<<INJECT: P0 UI test case IDs from Agent 02>>

Agent Output (generated files):
<<INJECT: output from Agent 04>>

Evaluation criteria:
1. Schema Compliance (10%): Is the files array structure valid?
2. POM Structure (25%): Do all 4 page classes exist with correct method contracts?
3. Locator Quality (20%): Are getByRole/getByLabel/getByTestId used over CSS?
4. Security (15%): Are all credentials/URLs from process.env?
5. Test Independence (15%): Does each test set up and tear down its own data?
6. Assertion Quality (15%): Are URL, title, and visibility assertions used correctly?

Score each dimension 0.0-1.0. Produce the evaluation JSON now.
```

---

## Sample Output

```json
{
  "agent_id": "test-design-engineer",
  "eval_timestamp": "2026-09-29T19:00:00Z",
  "overall_verdict": "WARN",
  "retry_recommended": false,
  "dimensions": [
    {
      "dimension": "Schema Compliance",
      "score": 1.0,
      "status": "PASS",
      "rationale": "All required fields present and correctly typed",
      "issues": []
    },
    {
      "dimension": "Count Adequacy",
      "score": 0.75,
      "status": "WARN",
      "rationale": "Part Delete has only 5 API cases, minimum is 8",
      "issues": ["FA-006 (Part Delete) has 5 API cases, expected ≥8"]
    },
    {
      "dimension": "Scenario Diversity",
      "score": 0.9,
      "status": "PASS",
      "rationale": "Happy path, boundary, negative covered for all areas. Auth failure missing for PATCH.",
      "issues": ["No auth failure test for PATCH /api/part/{id}/"]
    },
    {
      "dimension": "Traceability",
      "score": 1.0,
      "status": "PASS",
      "rationale": "All 60 test cases reference valid FA-xxx IDs",
      "issues": []
    },
    {
      "dimension": "Test Data Quality",
      "score": 0.85,
      "status": "PASS",
      "rationale": "Test data is specific and boundary-aware for most cases",
      "issues": []
    },
    {
      "dimension": "Priority Distribution",
      "score": 1.0,
      "status": "PASS",
      "rationale": "P0 cases present for all 6 functional areas",
      "issues": []
    }
  ],
  "aggregate_score": 0.75,
  "blocking_issues": [],
  "warnings": [
    "Part Delete (FA-006) has only 5 API test cases — below minimum of 8",
    "Auth failure test missing for PATCH endpoint"
  ],
  "improvement_suggestions": [
    "Add 3 more TC-API cases for FA-006: test delete with BOM reference, delete with stock, delete with confirmed dialog",
    "Add TC-API-0xx: PATCH /api/part/{id}/ without Authorization header, expect 401"
  ]
}
```

---

## Model Configuration

```json
{
  "model": "gemini-3.8-flash",
  "temperature": 0.1,
  "max_output_tokens": 8192,
  "response_mime_type": "application/json"
}
```

---

## Artefact

Eval reports saved to:
- `agent-artifacts/logs/evals/eval-agent-01.json`
- `agent-artifacts/logs/evals/eval-agent-02.json`
- `agent-artifacts/logs/evals/eval-agent-03.json`
- `agent-artifacts/logs/evals/eval-agent-04.json`
