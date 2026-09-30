import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for Create and Edit Part modal or form view.
 * Handles field input, category selection, boolean toggles, validation, and submission.
 */
export class PartFormPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly ipnInput: Locator;
  readonly categoryInput: Locator;
  readonly activeCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page
      .getByRole('textbox', { name: /text-field-name/i })
      .or(page.locator('input[name="name"]'))
      .or(page.getByLabel(/^name/i))
      .first();
    this.descriptionInput = page
      .getByRole('textbox', { name: /text-field-description/i })
      .or(page.locator('input[name="description"]'))
      .or(page.getByLabel(/description/i))
      .first();
    this.ipnInput = page
      .getByRole('textbox', { name: /text-field-IPN/i })
      .or(page.locator('input[name="IPN"]'))
      .or(page.getByLabel(/ipn/i))
      .first();
    this.categoryInput = page
      .getByRole('textbox', { name: /tree-field-category/i })
      .or(page.locator('input[placeholder*="Select category" i]'))
      .or(page.getByLabel(/category/i))
      .first();
    this.activeCheckbox = page
      .locator('input[name="active"], [aria-label="boolean-field-active"]')
      .first();
    this.submitButton = page
      .getByRole('button', { name: /^submit$/i })
      .or(page.getByRole('button', { name: /submit|save|create|confirm/i }))
      .first();
    this.cancelButton = page
      .getByRole('button', { name: /^cancel$/i })
      .or(page.getByRole('button', { name: /cancel/i }))
      .first();
  }

  /** Fills the required Part Name field */
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  /** Fills the optional Part Description field */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  /** Fills the Internal Part Number (IPN) */
  async fillIPN(ipn: string): Promise<void> {
    await this.ipnInput.fill(ipn);
  }

  /** Selects a category from category picker or dropdown */
  async selectCategory(categoryName: string): Promise<void> {
    await this.categoryInput.click();
    await this.categoryInput.fill(categoryName);
    const option = this.page
      .getByRole('option', { name: new RegExp(categoryName, 'i') })
      .or(this.page.locator('.mantine-Select-option').filter({ hasText: categoryName }))
      .or(this.page.getByText(categoryName, { exact: true }))
      .first();
    if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await option.click();
    }
  }

  /** Toggles the active status flag */
  async toggleActive(active: boolean): Promise<void> {
    const isChecked = await this.activeCheckbox.isChecked().catch(() => false);
    if (isChecked !== active) {
      await this.activeCheckbox.click();
    }
  }

  /** Submits the Part form */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Cancels the Part form */
  async cancel(): Promise<void> {
    try {
      await this.cancelButton.click({ timeout: 3_000 });
    } catch {
      await this.page.keyboard.press('Escape');
    }
  }

  /** Retrieves validation error message associated with a field */
  async getValidationError(fieldName: string): Promise<string> {
    const errorLocator = this.page
      .locator('.mantine-InputWrapper-error, [data-error="true"]')
      .or(this.page.getByText(new RegExp(`${fieldName}.*required|invalid|must|cannot|this field is required`, 'i')))
      .or(this.page.getByRole('alert'))
      .first();
    await errorLocator.waitFor({ state: 'visible', timeout: 5_000 });
    return (await errorLocator.textContent()) ?? '';
  }
}
