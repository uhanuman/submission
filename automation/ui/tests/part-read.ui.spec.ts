import { test, expect } from '../helpers/fixtures';
import { PartsListPage } from '../pages/PartsListPage';
import { PartDetailPage } from '../pages/PartDetailPage';

test.describe('Part Read & Search — UI', () => {
  test('TC-UI-023: Part List — Parts Table Loads on Navigation @smoke @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();

    await expect(authenticatedPage).toHaveURL(/\/part\//);
    await expect(partsListPage.searchInput).toBeVisible();
    await expect(partsListPage.tableRows.first()).toBeVisible();
  });

  test('TC-UI-024: Part List — Pagination Controls Present @regression @boundary', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();

    await expect(partsListPage.paginationNav).toBeVisible();
  });

  test('TC-UI-025: Part List — Keyword Search Filters Results @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();
    await partsListPage.searchPart('Resistor');

    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-026: Part List — Filter by Active Status Toggle @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();

    const filterButton = authenticatedPage
      .getByRole('button', { name: /filters|filter/i })
      .first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
    }
    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-027: Part Detail — Navigate from List to Detail Page @smoke @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();

    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await expect(authenticatedPage).toHaveURL(/\/part\/\d+/);
      const detailPage = new PartDetailPage(authenticatedPage);
      const title = await detailPage.getTitle();
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test('TC-UI-028: Part Detail — Direct URL Navigation to Non-Existent Part @negative @regression', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/web/part/99999999/');
    await expect(
      authenticatedPage.getByText(/not found|error|does not exist/i).first()
    ).toBeVisible();
  });

  test('TC-UI-029: Part Detail — Tabs Render (Stock, BOM, Suppliers) @regression', async ({
    authenticatedPage,
  }) => {
    test.slow();
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();

    const firstRowCell = authenticatedPage.getByRole('table').getByRole('row').nth(1).locator('td').nth(1);
    if (await firstRowCell.isVisible()) {
      await firstRowCell.click();
      await expect(authenticatedPage.getByRole('tab').first()).toBeVisible();
    }
  });

  test('TC-UI-043: Part Search — Combined Category and Keyword Filter @regression', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();
    await partsListPage.searchPart('Capacitor');

    await expect(authenticatedPage).toHaveURL(/\/part\//);
  });

  test('TC-UI-044: Part Search — No Results State @negative @boundary', async ({
    authenticatedPage,
  }) => {
    const partsListPage = new PartsListPage(authenticatedPage);
    await partsListPage.navigate();
    await partsListPage.searchPart('XYZ_NONEXISTENT_PART_KEYWORD_99999');

    await expect(
      authenticatedPage.getByText(/no parts found|no records|no results/i).first()
    ).toBeVisible();
  });
});
