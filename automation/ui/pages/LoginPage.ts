import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for the InvenTree Login Page.
 * Implements navigation, credentials entry, form submission, and login verification.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page
      .getByPlaceholder(/username/i)
      .or(page.getByLabel(/username/i))
      .first();
    this.passwordInput = page
      .getByPlaceholder(/password/i)
      .or(page.getByLabel(/password/i))
      .first();
    this.loginButton = page.getByRole('button', { name: /log in|sign in/i });
    this.errorMessage = page
      .getByRole('alert')
      .or(page.getByText(/unable to log in|invalid credentials|authentication error/i));
  }

  /** Navigates to the login page */
  async navigate(): Promise<void> {
    await this.page.goto('/web/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Fills user credentials into the form */
  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /** Submits the login form */
  async submit(): Promise<void> {
    await this.loginButton.click();
  }

  /** Checks if user is authenticated and redirected away from login */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Returns error message text when login fails */
  async getErrorMessage(): Promise<string> {
    await this.errorMessage.first().waitFor({ state: 'visible', timeout: 5_000 });
    return (await this.errorMessage.first().textContent()) ?? '';
  }
}
