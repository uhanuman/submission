import { test, expect } from '../helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import { PartsListPage } from '../pages/PartsListPage';
import { PartFormPage } from '../pages/PartFormPage';

test.describe('Part Create — UI', () => {
  const uniqueName = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  test('TC-UI-017: Part Create — Happy Path via Create Part Form @smoke @regression @auth', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);
    const partName = uniqueName('Capacitor-100uF');

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();

    await partFormPage.fillName(partName);
    await partFormPage.fillDescription('Ceramic capacitor 100uF SMD');
    await partFormPage.toggleActive(true);
    await partFormPage.submit();

    await expect(authenticatedPage).toHaveURL(/\/part\//);
    await expect(authenticatedPage.getByText(partName).first()).toBeVisible();
  });

  test('TC-UI-018: Part Create — Missing Name Validation @negative @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();

    await partFormPage.fillDescription('No name provided');
    await partFormPage.submit();

    const errorMsg = await partFormPage.getValidationError('name');
    expect(errorMsg.length).toBeGreaterThan(0);
  });

  test('TC-UI-019: Part Create — Missing Category Validation @negative @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await partFormPage.fillName(uniqueName('NoCategory'));
    await partFormPage.submit();

    // Verify either submission completes or validation highlights required category
    await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  });

  test('TC-UI-020: Part Create — Create Part as Inactive @boundary @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);
    const partName = uniqueName('Inactive-Part');

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await partFormPage.fillName(partName);
    await partFormPage.toggleActive(false);
    await partFormPage.submit();

    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-021: Part Create — Category as Prerequisite @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    const partFormPage = new PartFormPage(authenticatedPage);

    await partsListPage.navigate();
    await partsListPage.clickCreatePart();
    await expect(partFormPage.categoryInput).toBeVisible();
  });
});

baseTest.describe('Part Create — Unauthenticated Access', () => {
  baseTest(
    'TC-UI-022: Part Create — Unauthenticated Redirect @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
    }
  );
});
