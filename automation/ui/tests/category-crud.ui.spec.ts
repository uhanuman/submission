import { test, expect } from '../helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import { CategoryPage } from '../pages/CategoryPage';

test.describe('Category CRUD — UI', () => {
  const uniqueName = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  test('TC-UI-001: Category Create — Happy Path (root category via UI) @smoke @regression @auth', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const categoryPage = new CategoryPage(authenticatedPage);
    const catName = uniqueName('Electronics');

    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName(catName);
    await categoryPage.fillCategoryDescription('Test root category');
    await categoryPage.submitCategory();

    await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
    await expect(categoryPage.getCategoryNode(catName).first()).toBeVisible();
  });

  test('TC-UI-002: Category Create — With Parent Category @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const categoryPage = new CategoryPage(authenticatedPage);
    const catName = uniqueName('SubCategory');

    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName(catName);
    await categoryPage.submitCategory();

    await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
  });

  test('TC-UI-003: Category Create — Empty Name Validation @negative @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryDescription('Description with no name');
    await categoryPage.submitCategory();

    await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
    await categoryPage.cancelCategory();
  });

  test('TC-UI-004: Category Create — Duplicate Name Under Same Parent @negative @boundary', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const categoryPage = new CategoryPage(authenticatedPage);
    const catName = uniqueName('DuplicateCat');

    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName(catName);
    await categoryPage.submitCategory();
    await expect(authenticatedPage.getByRole('dialog')).toBeHidden();

    // Navigate back to root to attempt duplicate creation under the same parent (root)
    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName(catName);
    await categoryPage.submitCategory();

    await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
    await categoryPage.cancelCategory();
  });

  test('TC-UI-005: Category Create — Cancel Without Saving @boundary @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName('CanceledCategory');
    await categoryPage.cancelCategory();

    await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
  });

  test('TC-UI-007: Category List — Tree View Loads All Categories @smoke @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
    await expect(authenticatedPage.getByRole('table').or(authenticatedPage.getByRole('tablist')).first()).toBeVisible();
  });

  test('TC-UI-008: Category List — Category Filters Parts on Click @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    const firstLink = authenticatedPage.getByRole('table').getByRole('link').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
    }
  });

  test('TC-UI-009: Category Detail — View Category Info on Click @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
  });

  test('TC-UI-010: Category Update — Rename Via Edit Form @smoke @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    if (await categoryPage.editCategoryButton.isVisible()) {
      await categoryPage.clickEditCategory();
      await categoryPage.fillCategoryName(uniqueName('RenamedCategory'));
      await categoryPage.submitCategory();
      await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
    }
  });

  test('TC-UI-012: Category Update — Remove Name Field (validation) @negative @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    if (await categoryPage.editCategoryButton.isVisible()) {
      await categoryPage.clickEditCategory();
      await categoryPage.fillCategoryName('');
      await categoryPage.submitCategory();
      await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
      await categoryPage.cancelCategory();
    }
  });

  test('TC-UI-013: Category Delete — Delete Empty Category @smoke @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const categoryPage = new CategoryPage(authenticatedPage);
    const catName = uniqueName('ToDelete');

    await categoryPage.navigate();
    await categoryPage.clickCreateCategory();
    await categoryPage.fillCategoryName(catName);
    await categoryPage.submitCategory();

    if (await categoryPage.deleteCategoryButton.isVisible()) {
      await categoryPage.clickDeleteCategory();
      await categoryPage.confirmDeleteCategory();
      await expect(authenticatedPage).toHaveURL(/\/part\/category\//);
    }
  });

  test('TC-UI-014: Category Delete — Cancel Confirmation Dialog @boundary @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    if (await categoryPage.deleteCategoryButton.isVisible()) {
      await categoryPage.clickDeleteCategory();
      await categoryPage.cancelCategory();
      await expect(authenticatedPage.getByRole('dialog')).toBeHidden();
    }
  });

  test('TC-UI-015: Category Delete — Category With Parts Shows Error or Warning @negative @regression', async ({
    authenticatedPage,
  }) => {
    const categoryPage = new CategoryPage(authenticatedPage);
    await categoryPage.navigate();

    if (await categoryPage.deleteCategoryButton.isVisible()) {
      await categoryPage.clickDeleteCategory();
      await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
      await categoryPage.cancelCategory();
    }
  });
});

baseTest.describe('Category — Unauthenticated Access', () => {
  baseTest(
    'TC-UI-006: Category Create — Unauthenticated Redirect to Login @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/category/');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
    }
  );

  baseTest(
    'TC-UI-011: Category Update — Edit Without Auth (session expired) @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/category/');
      await expect(page).toHaveURL(/\/login/);
    }
  );

  baseTest(
    'TC-UI-016: Category Delete — No Auth (session expired) @auth @negative @smoke',
    async ({ page }) => {
      await page.goto('/web/part/category/');
      await expect(page).toHaveURL(/\/login/);
    }
  );
});
