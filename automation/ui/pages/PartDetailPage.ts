import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for InvenTree Part Detail View.
 * Provides access to part title, action buttons, field values, and deletion confirmation.
 */
export class PartDetailPage {
  readonly page: Page;
  readonly titleHeading: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titleHeading = page
      .locator('p[data-variant="gradient"]')
      .or(page.getByText(/part:/i))
      .or(page.getByRole('heading', { level: 1 }))
      .first();
    this.editButton = page
      .locator('button[aria-label="action-menu-part-actions"]')
      .or(page.getByRole('button', { name: /edit part|edit/i }))
      .or(page.getByTestId('edit-part-button'))
      .first();
    this.deleteButton = page
      .locator('button[aria-label="action-menu-part-actions"]')
      .or(page.getByRole('button', { name: /delete part|delete/i }))
      .or(page.getByTestId('delete-part-button'))
      .first();
    this.confirmDeleteButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /delete|confirm|yes|submit/i })
      .first();
    this.cancelDeleteButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /cancel|no/i })
      .first();
  }

  /** Navigates directly to a part detail page by ID */
  async navigate(partId: number | string): Promise<void> {
    await this.page.goto(`/web/part/${partId}/`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Returns primary title/heading of the part */
  async getTitle(): Promise<string> {
    await this.titleHeading.waitFor({ state: 'visible', timeout: 10_000 });
    return (await this.titleHeading.textContent()) ?? '';
  }

  /** Clicks the Edit Part action button */
  async clickEdit(): Promise<void> {
    const partActions = this.page.locator('button[aria-label="action-menu-part-actions"]');
    await partActions.waitFor({ state: 'visible', timeout: 15_000 });
    await partActions.click();
    const editItem = this.page.getByRole('menuitem', { name: /action-menu-part-actions-edit|edit/i }).first();
    await editItem.waitFor({ state: 'visible', timeout: 5_000 });
    await editItem.click();
  }

  /** Clicks the Delete Part action button to trigger confirmation modal */
  async clickDelete(): Promise<void> {
    const partActions = this.page.locator('button[aria-label="action-menu-part-actions"]');
    await partActions.waitFor({ state: 'visible', timeout: 15_000 });
    await partActions.click();
    const deleteItem = this.page.getByRole('menuitem', { name: /action-menu-part-actions-delete|delete/i }).first();
    await deleteItem.waitFor({ state: 'visible', timeout: 5_000 });
    await deleteItem.click();
  }

  /** Confirms deletion in the confirmation modal dialog */
  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Cancels deletion dialog */
  async cancelDelete(): Promise<void> {
    try {
      await this.cancelDeleteButton.click({ timeout: 3_000 });
    } catch {
      await this.page.keyboard.press('Escape');
    }
  }

  /** Retrieves text value of a labeled field or detail row */
  async getFieldValue(fieldName: string): Promise<string> {
    const fieldLocator = this.page
      .getByText(new RegExp(fieldName, 'i'))
      .locator('..')
      .locator('dd, span, div')
      .first();
    return (await fieldLocator.textContent()) ?? '';
  }
}
