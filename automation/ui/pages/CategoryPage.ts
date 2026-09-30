import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for Part Category tree, creation modal, and detail views.
 */
export class CategoryPage {
  readonly page: Page;
  readonly createCategoryButton: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly parentInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly editCategoryButton: Locator;
  readonly deleteCategoryButton: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createCategoryButton = page
      .getByRole('button', { name: /add-part-category|new category|add category|\+ category/i })
      .or(page.locator('button[aria-label*="add-part-category"]'))
      .first();
    this.nameInput = page
      .getByRole('textbox', { name: /text-field-name/i })
      .or(page.getByLabel(/^name/i))
      .or(page.locator('input[name="name"]'))
      .first();
    this.descriptionInput = page
      .getByRole('textbox', { name: /text-field-description/i })
      .or(page.getByLabel(/description/i))
      .or(page.locator('input[name="description"]'))
      .first();
    this.parentInput = page
      .getByRole('textbox', { name: /tree-field-parent/i })
      .or(page.getByLabel(/parent/i))
      .first();
    this.submitButton = page
      .getByRole('button', { name: /^submit$/i })
      .or(page.getByRole('button', { name: /save|submit|create/i }))
      .first();
    this.cancelButton = page.getByRole('button', { name: /^cancel$/i }).first();
    this.editCategoryButton = page
      .getByRole('button', { name: /action-button-edit-part-category|edit category|edit/i })
      .or(page.locator('button[aria-label*="edit-part-category"]'))
      .first();
    this.deleteCategoryButton = page
      .getByRole('button', { name: /action-button-delete-part-category|delete category|delete/i })
      .or(page.locator('button[aria-label*="delete-part-category"]'))
      .first();
    this.confirmDeleteButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /confirm|delete|yes/i });
  }

  /** Navigates to category tree view */
  async navigate(): Promise<void> {
    await this.page.goto('/web/part/category/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Opens Create Category dialog */
  async clickCreateCategory(): Promise<void> {
    await this.createCategoryButton.click();
  }

  /** Fills category name */
  async fillCategoryName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  /** Fills category description */
  async fillCategoryDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  /** Selects parent category */
  async selectParentCategory(parentName: string): Promise<void> {
    await this.parentInput.click();
    await this.page.getByRole('option', { name: parentName }).first().click();
  }

  /** Submits category form */
  async submitCategory(): Promise<void> {
    await this.submitButton.click();
  }

  /** Cancels category form */
  async cancelCategory(): Promise<void> {
    try {
      await this.cancelButton.click({ timeout: 3_000 });
    } catch {
      await this.page.keyboard.press('Escape');
    }
  }

  /** Locates category tree node by text */
  getCategoryNode(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  /** Clicks edit category */
  async clickEditCategory(): Promise<void> {
    const menuBtn = this.page.locator('button[aria-label="action-menu-category-actions"]');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      const editItem = this.page.getByRole('menuitem', { name: /edit/i }).first();
      if (await editItem.isVisible()) {
        await editItem.click();
        return;
      }
    }
    await this.editCategoryButton.click();
  }

  /** Clicks delete category */
  async clickDeleteCategory(): Promise<void> {
    const menuBtn = this.page.locator('button[aria-label="action-menu-category-actions"]');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      const delItem = this.page.getByRole('menuitem', { name: /delete/i }).first();
      if (await delItem.isVisible()) {
        await delItem.click();
        return;
      }
    }
    await this.deleteCategoryButton.click();
  }

  /** Confirms category deletion */
  async confirmDeleteCategory(): Promise<void> {
    await this.confirmDeleteButton.click();
  }
}
