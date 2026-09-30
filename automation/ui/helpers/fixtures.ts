import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/** Custom fixture types added on top of Playwright's base fixtures */
type AuthFixtures = {
  /**
   * A `Page` that is already authenticated as the test user.
   * The login flow runs once per test via the `authenticatedPage` fixture.
   */
  authenticatedPage: Page;
};

/**
 * Extended Playwright `test` object providing the `authenticatedPage` fixture.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const username = process.env.INVENTREE_USERNAME || 'admin';
    const password = process.env.INVENTREE_PASSWORD || 'Inventree-QA-2026!';

    if (!username || !password) {
      throw new Error(
        'INVENTREE_USERNAME and INVENTREE_PASSWORD must be configured in environment.'
      );
    }

    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.fillCredentials(username, password);
    await loginPage.submit();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 20_000,
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
