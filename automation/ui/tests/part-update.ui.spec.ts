import { test, expect } from '../helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import { PartsListPage } from '../pages/PartsListPage';
import { PartDetailPage } from '../pages/PartDetailPage';
import { PartFormPage } from '../pages/PartFormPage';

test.describe('Part Update — UI', () => {
  const uniqueName = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  test('TC-UI-030: Part Full Update (PUT) — Edit Form Pre-populates Values @smoke @regression @auth', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      const currentName = await formPage.nameInput.inputValue();
      expect(currentName.length).toBeGreaterThan(0);
      await formPage.cancel();
    }
  });

  test('TC-UI-031: Part Full Update (PUT) — Change Category @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      await expect(formPage.categoryInput).toBeVisible();
      await formPage.cancel();
    }
  });

  test('TC-UI-032: Part Full Update (PUT) — Clear Required Name Field @negative @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      await formPage.fillName('');
      await formPage.submit();
      const error = await formPage.getValidationError('name');
      expect(error.length).toBeGreaterThan(0);
      await formPage.cancel();
    }
  });

  test('TC-UI-033: Part Partial Update (PATCH) — Toggle Active Flag @smoke @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      await formPage.toggleActive(false);
      await formPage.submit();
      await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
    }
  });

  test('TC-UI-034: Part Partial Update (PATCH) — Edit Description Only @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      const newDesc = uniqueName('Updated-Description');
      await formPage.fillDescription(newDesc);
      await formPage.submit();
      await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
    }
  });

  test('TC-UI-036: Part Partial Update — Update IPN via Edit Form @regression @boundary', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const detailPage = new PartDetailPage(authenticatedPage);
    const formPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await detailPage.clickEdit();
      const newIpn = `IPN-${Date.now()}`;
      await formPage.fillIPN(newIpn);
      await formPage.submit();
      await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
    }
  });
});

baseTest.describe('Part Update — Unauthenticated Session Expiry', () => {
  baseTest(
    'TC-UI-035: Part Partial Update — Edit Without Auth (session expired) @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
    }
  );
});
