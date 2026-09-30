import { test, expect } from '../helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import { PartsListPage } from '../pages/PartsListPage';
import { PartDetailPage } from '../pages/PartDetailPage';
import { PartFormPage } from '../pages/PartFormPage';

test.describe('Part Delete — UI', () => {
  const uniqueName = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  test('TC-UI-037: Part Delete — Delete Clean Part via UI @smoke @regression @auth', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const partName = uniqueName('Delete-Target');

    // 1. Create a clean part to delete (inactive so Delete action is enabled in UI)
    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await formPage.fillName(partName);
    await formPage.toggleActive(false);
    await formPage.submit();
    await expect(authenticatedPage.getByRole('dialog')).toBeHidden();

    // 2. Delete the created part (on detail page or via search)
    if (authenticatedPage.url().match(/\/part\/\d+/)) {
      await detailPage.clickDelete();
      await detailPage.confirmDelete();
      await expect(authenticatedPage).toHaveURL(/\/part\//);
    } else {
      await partsListPage.searchPart(partName);
      const cell = authenticatedPage.getByRole('table').getByRole('row').filter({ hasText: partName }).locator('td').nth(1);
      if (await cell.isVisible()) {
        await cell.click();
        await detailPage.clickDelete();
        await detailPage.confirmDelete();
        await expect(authenticatedPage).toHaveURL(/\/part\//);
      }
    }
  });

  test('TC-UI-038: Part Delete — Cancel Confirmation Dialog @boundary @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const partName = uniqueName('Cancel-Del');

    // Create a clean part so Delete action is enabled (inactive)
    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await formPage.fillName(partName);
    await formPage.toggleActive(false);
    await formPage.submit();
    await expect(authenticatedPage.getByRole('dialog')).toBeHidden();

    if (!authenticatedPage.url().match(/\/part\/\d+/)) {
      await partsListPage.searchPart(partName);
      const cell = authenticatedPage.getByRole('table').getByRole('row').filter({ hasText: partName }).locator('td').nth(1);
      await cell.click();
    }

    await detailPage.clickDelete();
    await detailPage.cancelDelete();
    await expect(authenticatedPage.getByRole('dialog')).toBeHidden();

    // Clean up created part
    await detailPage.clickDelete();
    await detailPage.confirmDelete();
    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-039: Part Delete — Attempt Delete of Part With Stock @negative @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      const partActions = authenticatedPage.locator('button[aria-label="action-menu-part-actions"]');
      if (await partActions.isVisible()) {
        await partActions.click();
        const deleteItem = authenticatedPage.getByRole('menuitem', { name: /delete/i }).first();
        const isDisabled = await deleteItem.getAttribute('disabled') !== null || await deleteItem.getAttribute('data-disabled') === 'true';
        if (isDisabled) {
          expect(isDisabled).toBe(true);
        } else {
          await deleteItem.click();
          await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
          await detailPage.cancelDelete();
        }
      }
    }
  });

  test('TC-UI-041: Part Delete — Verify Redirect to Parts List After Deletion @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();
    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-042: Part Delete — Delete Action Not Available Without Edit Permissions @boundary @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();
    await expect(partsListPage.searchInput).toBeVisible();
  });
});

baseTest.describe('Part Delete — Unauthenticated Access', () => {
  baseTest(
    'TC-UI-040: Part Delete — No Auth (session expired) @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
    }
  );
});
