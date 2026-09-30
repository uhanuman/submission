# InvenTree UI Test Automation — Execution, Debugging, and Fix History

**Date**: 2026-10-01  
**Target Environment**: InvenTree 1.5.6 running in Docker (`http://localhost:8000`)  
**Test Framework**: Playwright Test (`@playwright/test`) with TypeScript & Chromium  
**Workspace**: `automation/ui`  
**Status**: 100% Passing (48 / 48 Full Regression Suite)

---

## 1. Executive Summary

This document records the end-to-end investigation, root cause diagnosis, architectural analysis, and implementation history for the InvenTree Playwright UI automated test suite. 

The task originated from user failure reports in `automation/ui/playwright-report`, where UI test executions failed across the board. The investigation resolved challenges spanning environment configuration, modern Mantine React UI component semantics, accessibility attribute naming conventions, asynchronous navigation lifecycle timing, and InvenTree's domain-specific business rules for part deletion.

Through targeted fixes across configuration, page objects, and test specifications, the complete UI test suite achieved **100% passing status (48 / 48 tests passing)** across all 6 test suites.

---

## 2. Phase 1: Environment & Base URL Configuration Analysis

### 2.1 Failure Symptom
Initial executions across the test suite failed immediately during the `beforeEach` hook or unauthenticated tests with the following protocol error:
```text
Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/web/login", waiting until "load"
```
Or an assertion error:
```text
expect(received).toBeGreaterThan(expected)
Expected: > 0
Received: 0
at auth.ui.spec.ts:14
```

### 2.2 Root Cause Analysis
In `automation/ui/playwright.config.ts`, `dotenv.config()` was called without specifying the explicit path to `automation/ui/.env`. When test execution commands were invoked from outside `automation/ui` (such as the workspace root or orchestrator runners):
- `process.env.INVENTREE_BASE_URL` was `undefined`.
- `process.env.INVENTREE_USERNAME` and `INVENTREE_PASSWORD` were `undefined`.
- Playwright's `use.baseURL` became undefined, turning relative URLs like `/web/login` into invalid navigation targets.

### 2.3 Resolution
1. **Absolute Path Resolution in `playwright.config.ts`**:
   Configured `dotenv` with `path.resolve(__dirname, '.env')` and provided a fallback default `baseURL`:
   ```typescript
   import dotenv from 'dotenv';
   import path from 'path';

   dotenv.config({ path: path.resolve(__dirname, '.env') });

   export default defineConfig({
     use: {
       baseURL: process.env.INVENTREE_BASE_URL || 'http://localhost:8000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
     },
     // ...
   });
   ```

2. **Resilient Credential Fallbacks in `helpers/fixtures.ts`**:
   Added default credential fallbacks for the local instance (`admin` / `Inventree-QA-2026!`):
   ```typescript
   const username = process.env.INVENTREE_USERNAME || 'admin';
   const password = process.env.INVENTREE_PASSWORD || 'Inventree-QA-2026!';
   ```

---

## 3. Phase 2: Authentication & Header Lifecycle (`auth.ui.spec.ts`)

### 3.1 Failure Symptom
In `auth.ui.spec.ts`, tests failed asserting user profile visibility or attempting to logout:
- The user menu was rendered asynchronously after React hydration.
- The logout option was located inside a Mantine dropdown menu tied to the user profile avatar button, requiring explicit user interaction.

### 3.2 Resolution
Updated `auth.ui.spec.ts`:
- Added credential fallbacks for standalone test runs.
- Waited for user profile button visibility (`page.locator('button').filter({ hasText: username })`).
- Handled logout by clicking the user avatar button, waiting for the Mantine menu dropdown to appear, and clicking the `Logout` menuitem.

**Result**: 4 / 4 tests passing in `auth.ui.spec.ts` (8.9s).

---

## 4. Phase 3: Part Category CRUD Suite & Mantine UI Tree Controls (`category-crud.ui.spec.ts`)

### 4.1 Mantine UI Accessibility & Structural Peculiarities
InvenTree v0.17+ migrated to a React single-page application built on Mantine UI. Inspection of DOM snapshots revealed:
1. **Technical `aria-label` Attributes**: Form inputs and buttons use technical component IDs as their accessibility names rather than standard user-facing labels:
   - Category Create Button: `button[aria-label="action-button-add-part-category"]`
   - Category Actions Menu: `button[aria-label="action-menu-category-actions"]`
   - Form Inputs: `aria-label="text-field-name"`, `aria-label="text-field-description"`, `aria-label="tree-field-parent"`
2. **Missing Native Form Label Association**: Inputs lack standard HTML `<label for="...">` associations, causing standard `page.getByLabel('Name')` calls to fail.
3. **Dropdown Action Menus vs. Direct Buttons**: Category edit and delete actions are grouped under an `action-menu-category-actions` dropdown menu.

### 4.2 Page Object & Spec Fixes
1. **[CategoryPage.ts](file:///c:/Users/uhanu/Workspace%20Github/case-study-inventree-gemini/test-automation-ai-orchestrator/automation/ui/pages/CategoryPage.ts)**:
   - Updated `createCategoryButton` locator to `button[aria-label*="add-part-category"]`.
   - Updated input locators to match Mantine's technical aria labels (`text-field-name`, `text-field-description`, `tree-field-parent`).
   - Updated `clickEditCategory` and `clickDeleteCategory` to open `button[aria-label="action-menu-category-actions"]` before selecting the menu items.
2. **`category-crud.ui.spec.ts`**:
   - `TC-UI-004` (Duplicate Name Validation): Added explicit wait for modal dismissal and returned to root category navigation before creating duplicate attempts.
   - `TC-UI-007` (Tree View): Replaced assertion on nonexistent `navigation` landmark with table/tablist visibility.

**Result**: 16 / 16 tests passing in `category-crud.ui.spec.ts`.

---

## 5. Phase 4: Part Creation, Reading, and Updating (`part-create`, `part-read`, `part-update`)

### 5.1 Parts List Page & Form Field Locators
- **Direct Navigation**: Updated `PartsListPage.navigate()` to go directly to `/web/part/category/index/parts` rather than `/web/part/`, avoiding intermediate redirects.
- **Search Input Ambiguity**: The global navigation header includes an `open-search` button (`aria-label="open-search"`). Calling `page.getByLabel(/search/i)` clicked the global header search instead of the table filter. Scoped `searchInput` to `textbox` matching `table-search-input`.
- **Create Part Action Menu**: Part creation is initiated via `button[aria-label="action-menu-add-parts"]` -> `menuitem[aria-label="action-menu-add-parts-create-part"]`.
- **Part Form Inputs**: Mapped `text-field-name`, `text-field-description`, `text-field-IPN`, `tree-field-category`, and `boolean-field-active`.
- **Mantine DataTable Row Navigation**: Mantine DataTable renders cells without anchor tags (`<a role="link">`). Tests expecting links failed. Updated `part-read.ui.spec.ts` and `part-update.ui.spec.ts` to navigate into details by clicking the second table cell (`row.locator('td').nth(1).click()`).

**Suite Results**:
- `part-create.ui.spec.ts`: 6 / 6 passed (20.1s)
- `part-read.ui.spec.ts`: 9 / 9 passed (30.1s)
- `part-update.ui.spec.ts`: 7 / 7 passed (15.5s)

---

## 6. Phase 5: Part Deletion Business Logic & InvenTree Architecture Deep Dive (`part-delete.ui.spec.ts`)

### 6.1 Failure Symptom in `TC-UI-037` and `TC-UI-038`
In `part-delete.ui.spec.ts`, tests `TC-UI-037` (Delete Clean Part) and `TC-UI-038` (Cancel Confirmation Dialog) failed:
```text
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('menuitem', { name: /action-menu-part-actions-delete|delete/i }).first()
    - locator resolved to <button disabled type="button" tabindex="-1" role="menuitem" data-disabled="true" aria-label="action-menu-part-actions-delete" ...>
  - element is not enabled
```

### 6.2 Architectural Deep Dive into Frontend Source
To determine why the Delete action was disabled on a freshly created part:
1. Checked running Docker containers (`ee0b3ca5b259` `inventree-server`, `5a53ac1d577d` `inventree-proxy`).
2. Verified backend permissions via API `OPTIONS /api/part/<id>/`: HTTP 200 returned with full `DELETE: {}` allowed for the `admin` user.
3. Inspected compiled frontend assets and sourcemaps in `/var/www/static/web/assets` (`PartDetail-fvESkFvL.js.map`).
4. Extracted original React source code for `PartDetail.tsx`:
   ```tsx
   // frontend/src/pages/part/PartDetail.tsx
   DeleteItemAction({
     hidden: !user.hasDeleteRole(UserRoles.part),
     disabled: part.active,
     onClick: () => deletePart.open()
   })
   ```

### 6.3 Critical Finding: InvenTree Part Deletion Precondition
InvenTree enforces a strict business rule in its user interface:
> **A part cannot be deleted while it is active (`disabled: part.active`). To delete a part in the UI, it must first be set to inactive (`active: false`).**

When parts are created through the standard UI form, `active` defaults to `true`. Consequently, `action-menu-part-actions-delete` was intentionally rendered with `disabled` / `data-disabled="true"`.

### 6.4 PartDetailPage Timing Resolution
Furthermore, in `PartDetailPage.ts`:
- `clickDelete()` had a 2-second timeout check (`partActions.isVisible({ timeout: 2_000 })`). When the page was still completing route transitions, this evaluated to `false` and prematurely clicked `this.deleteButton` (the menu trigger itself), leaving the menu hanging open and causing confirmation modal clicks to time out.
- Refactored `clickDelete()` and `clickEdit()` to explicitly await `partActions` visibility (15s timeout), open the menu, await the menuitem visibility (5s timeout), and click the target menu item.
- Widened confirmation dialog button matching regex to `/delete|confirm|yes|submit/i`.

### 6.5 Test Specification Fix
Updated `TC-UI-037` and `TC-UI-038` in `part-delete.ui.spec.ts` to create the target parts with `await formPage.toggleActive(false)`.

**Result**: 6 / 6 tests passing in `part-delete.ui.spec.ts` (21.5s).

---

## 7. Summary of Modified Files

| File Path | Nature of Changes |
| :--- | :--- |
| `automation/ui/playwright.config.ts` | Loaded `.env` using absolute path resolution; added fallback `baseURL`. |
| `automation/ui/helpers/fixtures.ts` | Added default credentials fallbacks for `admin` user. |
| `automation/ui/pages/CategoryPage.ts` | Updated button, input, tree, and action menu locators for Mantine compatibility. |
| `automation/ui/pages/PartsListPage.ts` | Scoped table search input; configured action dropdown for part creation; fixed row selector. |
| `automation/ui/pages/PartFormPage.ts` | Mapped Mantine text, tree, switch, and submit/cancel button locators. |
| `automation/ui/pages/PartDetailPage.ts` | Implemented robust action menu expansion and menuitem click sequence; updated modal locators. |
| `automation/ui/tests/auth.ui.spec.ts` | Added credential fallbacks and robust avatar-based logout flow. |
| `automation/ui/tests/category-crud.ui.spec.ts` | Handled modal dismissals and tree view assertions cleanly. |
| `automation/ui/tests/part-create.ui.spec.ts` | Verified part creation and inactive switch behavior. |
| `automation/ui/tests/part-read.ui.spec.ts` | Updated row link clicks to table cell clicks. |
| `automation/ui/tests/part-update.ui.spec.ts` | Updated row link clicks to table cell clicks. |
| `automation/ui/tests/part-delete.ui.spec.ts` | Created deletion targets as inactive (`toggleActive(false)`) to satisfy InvenTree UI prerequisites. |

---

## 8. Final Verification Results

### Full Regression Suite Run
Command executed:
```bash
npx playwright test
```

Execution output:
```text
Running 48 tests using 1 worker

  ok  1 [ui-tests] › tests\auth.ui.spec.ts: TC-UI-045: Auth — Login With Valid Credentials @smoke @auth (2.5s)
  ok  2 [ui-tests] › tests\auth.ui.spec.ts: TC-UI-046: Auth — Login With Invalid Credentials @negative @auth (1.6s)
  ok  3 [ui-tests] › tests\auth.ui.spec.ts: TC-UI-047: Auth — Access Protected Page While Logged Out @auth @negative @smoke (635ms)
  ok  4 [ui-tests] › tests\auth.ui.spec.ts: TC-UI-048: Auth — Logout Clears Session @auth @regression (2.9s)
  ok  5 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-001: Category Create — Happy Path (root category) @smoke @regression @auth (3.9s)
  ok  6 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-002: Category Create — With Parent Category @regression (3.9s)
  ok  7 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-003: Category Create — Empty Name Validation @negative @regression (4.2s)
  ok  8 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-004: Category Create — Duplicate Name Under Same Parent @negative @boundary (5.4s)
  ok  9 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-005: Category Create — Cancel Without Saving @boundary @regression (4.0s)
  ok 10 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-007: Category List — Tree View Loads All Categories @smoke @regression (2.7s)
  ok 11 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-008: Category List — Category Filters Parts on Click @regression (2.5s)
  ok 12 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-009: Category Detail — View Category Info on Click @regression (2.3s)
  ok 13 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-010: Category Update — Rename Via Edit Form @smoke @regression (2.4s)
  ok 14 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-012: Category Update — Remove Name Field (validation) @negative @regression (2.4s)
  ok 15 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-013: Category Delete — Delete Empty Category @smoke @regression (3.6s)
  ok 16 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-014: Category Delete — Cancel Confirmation Dialog @boundary @regression (2.4s)
  ok 17 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-015: Category Delete — Category With Parts Shows Error or Warning @negative @regression (2.4s)
  ok 18 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-006: Category Create — Unauthenticated Redirect to Login @auth @negative @smoke (639ms)
  ok 19 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-011: Category Update — Edit Without Auth @auth @negative @smoke (472ms)
  ok 20 [ui-tests] › tests\category-crud.ui.spec.ts: TC-UI-016: Category Delete — No Auth @auth @negative @smoke (454ms)
  ok 21 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-017: Part Create — Happy Path via Create Part Form @smoke @regression @auth (4.6s)
  ok 22 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-018: Part Create — Missing Name Validation @negative @regression (3.7s)
  ok 23 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-019: Part Create — Missing Category Validation @negative @regression (3.7s)
  ok 24 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-020: Part Create — Create Part as Inactive @boundary @regression (3.8s)
  ok 25 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-021: Part Create — Category as Prerequisite @regression (3.4s)
  ok 26 [ui-tests] › tests\part-create.ui.spec.ts: TC-UI-022: Part Create — Unauthenticated Redirect @auth @negative @smoke (622ms)
  ok 27 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-037: Part Delete — Delete Clean Part via UI @smoke @regression @auth (5.4s)
  ok 28 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-038: Part Delete — Cancel Confirmation Dialog @boundary @regression (6.7s)
  ok 29 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-039: Part Delete — Attempt Delete of Part With Stock @negative @regression (2.7s)
  ok 30 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-041: Part Delete — Verify Redirect to Parts List After Deletion @regression (2.4s)
  ok 31 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-042: Part Delete — Delete Action Not Available Without Edit Permissions @boundary @regression (3.3s)
  ok 32 [ui-tests] › tests\part-delete.ui.spec.ts: TC-UI-040: Part Delete — No Auth @auth @negative @smoke (660ms)
  ok 33 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-023: Part List — Parts Table Loads on Navigation @smoke @regression (3.3s)
  ok 34 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-024: Part List — Pagination Controls Present @regression @boundary (4.0s)
  ok 35 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-025: Part List — Keyword Search Filters Results @regression (4.3s)
  ok 36 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-026: Part List — Filter by Active Status Toggle @regression (2.4s)
  ok 37 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-027: Part Detail — Navigate from List to Detail Page @smoke @regression (2.4s)
  ok 38 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-028: Part Detail — Direct URL Navigation to Non-Existent Part @negative @regression (3.7s)
  ok 39 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-029: Part Detail — Tabs Render (Stock, BOM, Suppliers) @regression (2.4s)
  ok 40 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-043: Part Search — Combined Category and Keyword Filter @regression (4.2s)
  ok 41 [ui-tests] › tests\part-read.ui.spec.ts: TC-UI-044: Part Search — No Results State @negative @boundary (4.2s)
  ok 42 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-030: Part Full Update (PUT) — Edit Form Pre-populates Values @smoke @regression @auth (2.4s)
  ok 43 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-031: Part Full Update (PUT) — Change Category @regression (2.4s)
  ok 44 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-032: Part Full Update (PUT) — Clear Required Name Field @negative @regression (2.3s)
  ok 45 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-033: Part Partial Update (PATCH) — Toggle Active Flag @smoke @regression (2.4s)
  ok 46 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-034: Part Partial Update (PATCH) — Edit Description Only @regression (2.4s)
  ok 47 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-036: Part Partial Update — Update IPN via Edit Form @regression @boundary (2.4s)
  ok 48 [ui-tests] › tests\part-update.ui.spec.ts: TC-UI-035: Part Partial Update — Edit Without Auth @auth @negative @smoke (813ms)

  48 passed (2.3m)
```

**Overall Result**: 48 / 48 tests passing (100% success rate, 0 flakes, 0 skips).  
**Playwright HTML Report**: Generated and updated cleanly at `automation/ui/playwright-report/index.html`.
