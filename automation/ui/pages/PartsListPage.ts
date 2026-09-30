import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for InvenTree Parts List View.
 * Handles table search, part row retrieval, pagination, and opening part creation.
 */
export class PartsListPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly createPartButton: Locator;
  readonly tableRows: Locator;
  readonly paginationNav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page
      .getByRole('textbox', { name: /table-search-input|search/i })
      .or(page.locator('input[placeholder*="Search" i], [aria-label="table-search-input"]'))
      .first();
    this.createPartButton = page
      .locator('button[aria-label="action-menu-add-parts"]')
      .or(page.getByRole('button', { name: /add parts|new part|create part/i }))
      .first();
    this.tableRows = page.getByRole('row');
    this.paginationNav = page
      .getByRole('navigation', { name: /pagination/i })
      .or(page.getByRole('button', { name: /next page|previous page/i }))
      .or(page.locator('button[aria-label="Next page"], button[aria-label="Previous page"]'))
      .first();
  }

  /** Navigates directly to the Parts list page */
  async navigate(): Promise<void> {
    await this.page.goto('/web/part/category/index/parts');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Clicks button to open Create Part dialog or form */
  async clickCreatePart(): Promise<void> {
    await this.createPartButton.click();
    const createItem = this.page.getByRole('menuitem', { name: /create-part|create part/i }).first();
    await createItem.waitFor({ state: 'visible', timeout: 5_000 });
    await createItem.click();
    await this.page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5_000 });
  }

  /** Searches for parts by keyword */
  async searchPart(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1_000);
  }

  /** Locates a row in the table matching part name */
  getPartRow(name: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') }).or(this.page.locator('tr').filter({ hasText: name }));
  }

  /** Counts number of rows visible in the parts table */
  async getPartCount(): Promise<number> {
    await this.page.waitForLoadState('domcontentloaded');
    const rows = await this.tableRows.count();
    return Math.max(0, rows - 1);
  }
}
