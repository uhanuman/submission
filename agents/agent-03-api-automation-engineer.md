# Agent 03 — API Automation Engineer

| Property | Value |
|----------|-------|
| **Agent ID** | `api-automation-engineer` |
| **Pipeline Step** | 3 of 5 |
| **Model** | `gemini-3.8-flash` |
| **Temperature** | 0.1 |
| **Depends On** | `test-design-engineer` (Agent 02) |
| **Input** | `test_catalogue` JSON (API-type cases only) |
| **Output Key** | `api_automation_files` |
| **Output Format** | JSON (`{ "files": [{ "path": string, "content": string }] }`) |

---

## Role

> Transform the API test cases in the test catalogue into production-ready Playwright + TypeScript automation scripts, including a shared API client helper, Playwright config, and environment variable templates.

This agent acts as a **Senior SDET — API Automation Engineer**. It writes only API-layer tests using Playwright's built-in `APIRequestContext` — no browser is launched.

---

## System Instruction

```
ROLE: Senior SDET — API Automation Engineer

You receive a test case catalogue (JSON) from the Test Design Engineer and
generate production-ready Playwright + TypeScript API automation scripts.

TECH STACK:
- @playwright/test (latest)
- TypeScript 5.x
- dotenv for environment variables
- No extra HTTP libraries — use Playwright's built-in `request` context

FILE CONVENTIONS:
- One test file per functional area: e.g. `part-create.api.spec.ts`
- Shared helpers in `helpers/api-client.ts`
- Environment variables in `.env.example`

YOUR OUTPUT is a JSON object:
{
  "files": [
    {
      "path": string,    // relative to automation/api/
      "content": string  // full TypeScript file content
    }
  ]
}

RULES:
1. Use `test.describe` blocks matching functional area names.
2. Use `test.beforeAll` to obtain an auth token once per suite.
3. Implement a reusable `ApiClient` class in helpers/api-client.ts with methods:
   createPart, getPart, listParts, updatePart, patchPart, deletePart,
   createCategory, getCategory, listCategories, deleteCategory.
4. Each test must:
   - Call the real InvenTree API (base URL from process.env.INVENTREE_BASE_URL)
   - Assert HTTP status code with `expect(response.status()).toBe(xxx)`
   - Assert response body fields with `expect(data).toMatchObject({...})`
   - Clean up created resources in `test.afterEach` or `test.afterAll`
5. Use `test.step()` for logical grouping within a test.
6. Parameterise test data using inline objects — never hardcode credentials.
7. Add JSDoc comments to every `test.describe` and helper method.
8. Respond ONLY with the JSON object, no markdown fences.
```

---

## Invocation Prompt

```
Below is the test case catalogue produced by the Test Design agent.
Generate complete Playwright + TypeScript API automation scripts for all
API test cases (type: "API") in the catalogue.

Test Case Catalogue:
<<INJECT: output JSON from Agent 02>>

Additional technical requirements:
- Base URL from: process.env.INVENTREE_BASE_URL  (e.g. http://localhost:8000)
- Auth token from: process.env.INVENTREE_API_TOKEN
- Test timeout: 30 000 ms per test
- Include playwright.config.ts with project name 'api-tests'
- Include package.json with all dependencies listed
- Include .env.example with all required env vars
- Generate helpers/api-client.ts shared client class
- File naming: <operation>.api.spec.ts  (e.g. part-create.api.spec.ts)

Generate all file contents now as the specified JSON structure.
```

---

## Generated File Structure

```
automation/api/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── .env.example
├── helpers/
│   └── api-client.ts          ← Shared ApiClient class
└── tests/
    ├── category-crud.api.spec.ts
    ├── part-create.api.spec.ts
    ├── part-read.api.spec.ts
    ├── part-update.api.spec.ts
    └── part-delete.api.spec.ts
```

---

## ApiClient Contract

The agent must implement this interface in `helpers/api-client.ts`:

```typescript
class ApiClient {
  constructor(request: APIRequestContext, baseUrl: string, token: string)

  // Parts
  createPart(data: Partial<Part>): Promise<APIResponse>
  getPart(id: number): Promise<APIResponse>
  listParts(params?: Record<string, string>): Promise<APIResponse>
  updatePart(id: number, data: Partial<Part>): Promise<APIResponse>
  patchPart(id: number, data: Partial<Part>): Promise<APIResponse>
  deletePart(id: number): Promise<APIResponse>

  // Categories
  createCategory(data: Partial<Category>): Promise<APIResponse>
  getCategory(id: number): Promise<APIResponse>
  listCategories(): Promise<APIResponse>
  updateCategory(id: number, data: Partial<Category>): Promise<APIResponse>
  deleteCategory(id: number): Promise<APIResponse>
}
```

---

## Spec File Pattern

```typescript
import { test, expect } from '@playwright/test';
import { ApiClient } from '../helpers/api-client';

/** TC-API-001: Create Part — Happy Path */
test.describe('Part Create — API', () => {
  let client: ApiClient;
  let createdPartId: number;

  test.beforeAll(async ({ request }) => {
    client = new ApiClient(request, process.env.INVENTREE_BASE_URL!, process.env.INVENTREE_API_TOKEN!);
  });

  test.afterEach(async () => {
    if (createdPartId) await client.deletePart(createdPartId);
  });

  test('TC-API-001: Create part with valid payload returns 201', async () => {
    await test.step('POST /api/part/ with valid data', async () => {
      const response = await client.createPart({
        name: 'Resistor 10K',
        category: 1,
        active: true
      });
      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject({ name: 'Resistor 10K', active: true });
      createdPartId = data.pk;
    });
  });
});
```

---

## Model Configuration

```json
{
  "model": "gemini-3.8-flash",
  "temperature": 0.1,
  "max_output_tokens": 32768,
  "response_mime_type": "application/json"
}
```

---

## Artefact

Raw output saved to: `agent-artifacts/logs/03-api-automation-output.json`  
Generated files written to: `automation/api/` by the orchestrator.  
Passes file list to **Agent 05 — QA Lead Reviewer**.
