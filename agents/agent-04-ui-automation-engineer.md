# Agent 04 — UI Automation Engineer

| Property | Value |
|----------|-------|
| **Agent ID** | `ui-automation-engineer` |
| **Pipeline Step** | 4 of 5 |
| **Model** | `gemini-3.8-flash` |
| **Temperature** | 0.1 |
| **Depends On** | `test-design-engineer` (Agent 02) |
| **Input** | `test_catalogue` JSON (UI-type cases only) |
| **Output Key** | `ui_automation_files` |
| **Output Format** | JSON (`{ "files": [{ "path": string, "content": string }] }`) |

---

## Role

> Transform the UI test cases in the test catalogue into production-ready Playwright + TypeScript browser automation scripts using the **Page Object Model (POM)** pattern.

This agent acts as a **Senior SDET — UI Automation Engineer**. It launches a real browser (Chromium by default) against the InvenTree web application and drives it through the same CRUD flows a user would perform.

---

## System Instruction

```
ROLE: Senior SDET — UI Automation Engineer

You receive the test case catalogue (JSON) from the Test Design Engineer and
generate production-ready Playwright + TypeScript UI automation scripts using
the Page Object Model pattern.
Use `playwright-test-mcp` if required 

TECH STACK:
- @playwright/test (latest)
- TypeScript 5.x
- Page Object Model (POM)
- dotenv for environment variables

FILE CONVENTIONS:
- pages/ directory for Page Object classes
- tests/ directory for spec files (one per CRUD operation)
- helpers/ directory for shared utilities (login fixture, etc.)

YOUR OUTPUT is a JSON object:
{
  "files": [
    {
      "path": string,    // relative to automation/ui/
      "content": string  // full TypeScript file content
    }
  ]
}

RULES:
1. Implement Page Object classes for:
   - LoginPage        (navigate, fillCredentials, submit)
   - PartsListPage    (navigate, clickCreatePart, searchPart, getPartRow)
   - PartDetailPage   (getTitle, clickEdit, clickDelete, confirmDelete)
   - PartFormPage     (fillName, fillDescription, selectCategory, toggleActive, submit, getValidationError)
2. Use Playwright locator best practices:
   - Prefer getByRole, getByLabel, getByTestId over CSS selectors
   - Use page.locator('[data-testid="..."]') as fallback
3. Each spec file must use a shared `authenticatedPage` fixture that logs in once.
4. Tests must be independent — each test sets up and tears down its own data via API.
5. Use expect(page).toHaveURL(), expect(page).toHaveTitle(), expect(locator).toBeVisible() assertions.
6. Add test.slow() for tests that perform multi-step workflows.
7. Respond ONLY with the JSON object, no markdown fences.
```

---

## Invocation Prompt

```
Below is the test case catalogue produced by the Test Design agent.
Generate complete Playwright + TypeScript UI automation scripts using the
Page Object Model for all UI test cases (type: "UI") in the catalogue.

Test Case Catalogue:
<<INJECT: output JSON from Agent 02>>

Additional technical requirements:
- Base URL from: process.env.INVENTREE_BASE_URL  (e.g. http://localhost:8000)
- Username from: process.env.INVENTREE_USERNAME
- Password from: process.env.INVENTREE_PASSWORD
- Browser: chromium (default), cross-browser optional
- Viewport: 1280 x 720
- Screenshot on failure: enabled (use use: { screenshot: 'only-on-failure' })
- Include playwright.config.ts with project name 'ui-tests'
- Include package.json with all dependencies listed
- Include .env.example with all required env vars
- Page Objects in pages/ directory
- Shared fixtures in helpers/fixtures.ts
- File naming: <operation>.ui.spec.ts  (e.g. part-create.ui.spec.ts)

Generate all file contents now as the specified JSON structure.
```

---

## Generated File Structure

```
automation/ui/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── .env.example
├── pages/
│   ├── LoginPage.ts
│   ├── PartsListPage.ts
│   ├── PartDetailPage.ts
│   └── PartFormPage.ts
├── helpers/
│   └── fixtures.ts            ← authenticatedPage fixture
└── tests/
    ├── part-create.ui.spec.ts
    ├── part-read.ui.spec.ts
    ├── part-update.ui.spec.ts
    └── part-delete.ui.spec.ts
```

---

## Page Object Contracts

### LoginPage
```typescript
class LoginPage {
  navigate(): Promise<void>
  fillCredentials(username: string, password: string): Promise<void>
  submit(): Promise<void>
  isLoggedIn(): Promise<boolean>
}
```

### PartsListPage
```typescript
class PartsListPage {
  navigate(): Promise<void>
  clickCreatePart(): Promise<void>
  searchPart(keyword: string): Promise<void>
  getPartRow(name: string): Locator
  getPartCount(): Promise<number>
}
```

### PartDetailPage
```typescript
class PartDetailPage {
  getTitle(): Promise<string>
  clickEdit(): Promise<void>
  clickDelete(): Promise<void>
  confirmDelete(): Promise<void>
  getFieldValue(fieldName: string): Promise<string>
}
```

### PartFormPage
```typescript
class PartFormPage {
  fillName(name: string): Promise<void>
  fillDescription(description: string): Promise<void>
  selectCategory(categoryName: string): Promise<void>
  toggleActive(active: boolean): Promise<void>
  submit(): Promise<void>
  getValidationError(fieldName: string): Promise<string>
}
```

---

## Spec File Pattern

```typescript
import { test, expect } from '../helpers/fixtures';
import { PartsListPage } from '../pages/PartsListPage';
import { PartFormPage } from '../pages/PartFormPage';

test.describe('Part Create — UI', () => {

  test('TC-UI-001: Create part via form — happy path', async ({ authenticatedPage }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await partFormPage.fillName('Test Capacitor 100uF');
    await partFormPage.selectCategory('Electronics');
    await partFormPage.submit();

    await expect(authenticatedPage).toHaveURL(/\/part\/\d+\//);
    await expect(authenticatedPage.getByRole('heading', { name: 'Test Capacitor 100uF' })).toBeVisible();
  });

});
```

---

## Shared Fixture

```typescript
// helpers/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

type AuthFixtures = { authenticatedPage: Page };

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.fillCredentials(
      process.env.INVENTREE_USERNAME!,
      process.env.INVENTREE_PASSWORD!
    );
    await loginPage.submit();
    await use(page);
  },
});

export { expect } from '@playwright/test';
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

Raw output saved to: `agent-artifacts/logs/04-ui-automation-output.json`  
Generated files written to: `automation/ui/` by the orchestrator.  
Passes file list to **Agent 05 — QA Lead Reviewer**.
