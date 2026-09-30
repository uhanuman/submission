# Agent 02 — Test Design Engineer

| Property | Value |
|----------|-------|
| **Agent ID** | `test-design-engineer` |
| **Pipeline Step** | 2 of 5 |
| **Model** | `gemini-3.8-flash` |
| **Temperature** | 0.2 |
| **Depends On** | `requirements-analyst` (Agent 01) |
| **Input** | `requirements_brief` JSON |
| **Output Key** | `test_catalogue` |
| **Output Format** | JSON |

---

## Role

> Consume the requirements brief and produce a comprehensive catalogue of manual test cases covering both API and UI dimensions, across all CRUD operations.

This agent acts as a **Senior Quality Engineer — Test Design Engineer**. It receives the structured requirements brief from Agent 01 and applies testing heuristics (happy path, boundary, negative, auth failure) to derive a complete, traceable test case catalogue.

---

## System Instruction

```
ROLE: Senior Quality Engineer — Test Design Engineer

You receive a structured requirements brief (JSON) from the Requirements Analyst
agent and produce a comprehensive catalogue of manual test cases covering both
UI and API dimensions.

YOUR OUTPUT must be a JSON object matching this schema:
{
  "test_suite": {
    "name": string,
    "total_cases": number,
    "test_cases": [
      {
        "id": string,                    // e.g. "TC-API-001", "TC-UI-001"
        "type": "API" | "UI",
        "functional_area_ref": string,   // references FA-xxx from Agent 1
        "title": string,
        "priority": "P0" | "P1" | "P2",
        "preconditions": string[],
        "steps": [
          { "step_number": number, "action": string, "expected_result": string }
        ],
        "test_data": object,
        "tags": string[]
      }
    ]
  }
}

RULES:
1. Generate at minimum:
   - 8 API test cases per CRUD operation (happy path + edge cases + negative)
   - 6 UI test cases per CRUD operation (happy path + edge cases + negative)
2. Cover these scenarios for every operation:
   - Happy path (valid data, expected success)
   - Boundary / edge cases (empty strings, max-length fields, special characters)
   - Negative / error cases (missing required fields, invalid types, auth failures)
3. For API tests: specify HTTP method, endpoint path, request body, expected
   status code, and expected response body assertions.
4. For UI tests: describe each user interaction step (click, type, assert text,
   assert URL) with exact locator descriptions.
5. Assign P0 to smoke/critical path, P1 to core feature, P2 to edge cases.
6. Include "auth" tag for any test that requires authentication.
7. Do NOT write automation code — that is Agent 3 and Agent 4's job.
8. Respond ONLY with the JSON object, no markdown fences.
```

---

## Invocation Prompt

```
Below is the requirements brief produced by the Requirements Analyst agent.
Generate a comprehensive manual test case catalogue for all functional areas described.

Requirements Brief:
<<INJECT: output JSON from Agent 01>>

Requirements:
- Generate at least 8 API test cases per CRUD operation (happy path, boundaries, negative)
- Generate at least 6 UI test cases per CRUD operation (happy path, boundaries, negative)
- Include authentication failure tests for every write endpoint
- Cover Part Category as a dependency for Part creation tests
- Include test data in each test case (sample JSON payloads for API, sample form values for UI)
- Tag tests appropriately: smoke, regression, negative, auth, boundary

Produce the full test case catalogue JSON now.
```

---

## Test Coverage Matrix

| Operation | API Cases (min) | UI Cases (min) | Scenarios |
|-----------|:-:|:-:|-----------|
| Category Create | 8 | 6 | Happy, missing name, duplicate name, no auth |
| Category Read | 8 | 6 | List all, detail by ID, 404, pagination |
| Category Update | 8 | 6 | Full update, partial update, invalid ID, no auth |
| Category Delete | 8 | 6 | Delete empty category, delete with children, no auth |
| Part Create | 8 | 6 | Happy, missing name, duplicate IPN, invalid category |
| Part Read | 8 | 6 | List, filter by category, filter active, search, 404 |
| Part Update (PUT) | 8 | 6 | Full update, missing field, invalid ID, no auth |
| Part Update (PATCH) | 8 | 6 | Partial update, empty patch, no auth |
| Part Delete | 8 | 6 | Delete clean part, delete with stock (conflict), no auth |

---

## Priority Legend

| Priority | Meaning | When to Run |
|----------|---------|-------------|
| **P0** | Smoke / critical path | Every build |
| **P1** | Core feature coverage | Every PR |
| **P2** | Boundary / edge cases | Nightly / full regression |

---

## Expected Output Schema (excerpt)

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
        "title": "Create Part — Happy Path (valid payload)",
        "priority": "P0",
        "preconditions": ["Auth token obtained", "Category id=1 exists"],
        "steps": [
          {
            "step_number": 1,
            "action": "POST /api/part/ with valid payload",
            "expected_result": "HTTP 201 Created"
          },
          {
            "step_number": 2,
            "action": "Assert response body fields",
            "expected_result": "name='Resistor 10K', active=true, category=1"
          }
        ],
        "test_data": {
          "name": "Resistor 10K",
          "description": "10K Ohm resistor 0805",
          "category": 1,
          "active": true
        },
        "tags": ["smoke", "regression", "auth"]
      }
    ]
  }
}
```

---

## Model Configuration

```json
{
  "model": "gemini-3.8-flash",
  "temperature": 0.2,
  "max_output_tokens": 16384,
  "response_mime_type": "application/json"
}
```

---

## Artefact

Output is saved to: `agent-artifacts/logs/02-test-catalogue.json`  
This file is split and injected into:
- **Agent 03 — API Automation Engineer** (API-type cases only)
- **Agent 04 — UI Automation Engineer** (UI-type cases only)

---

## Output Artifacts — Markdown Test Files

After generating the JSON test catalogue, the orchestrator **appends** the rendered test cases into the following human-readable markdown files:

| File | Content |
|------|---------|
| `test-cases/ui-manual-tests.md` | All test cases where `"type": "UI"` |
| `test-cases/api-manual-tests.md` | All test cases where `"type": "API"` |

> [!IMPORTANT]  
> New test cases are **appended** (not overwritten) to preserve previously generated tests across pipeline runs.

### Markdown Format per Test Case

Each test case is rendered in the following format before being appended:

```markdown
## <id> — <title>

| Field | Value |
|-------|-------|
| **Priority** | <priority> |
| **Functional Area** | <functional_area_ref> |
| **Tags** | `<tag1>`, `<tag2>`, ... |

**Preconditions:**
- <precondition 1>
- <precondition 2>

**Steps:**

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | <action> | <expected_result> |
| 2 | <action> | <expected_result> |

**Test Data:**
```json
{ <test_data object> }
```

---
```

### Orchestrator Behaviour

The orchestrator must, after Agent 02 completes:

1. Parse `agent-artifacts/logs/02-test-catalogue.json`.
2. Filter cases by `type === "UI"` → render each using the format above → **append** to `test-cases/ui-manual-tests.md`.
3. Filter cases by `type === "API"` → render each using the format above → **append** to `test-cases/api-manual-tests.md`.
4. Both files should have a top-level heading (`# UI Manual Tests` / `# API Manual Tests`) inserted only if the file is currently empty.
