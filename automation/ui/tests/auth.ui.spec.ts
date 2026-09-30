import { test as baseTest, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

baseTest.describe('Authentication — UI', () => {
  baseTest('TC-UI-045: Auth — Login With Valid Credentials @smoke @auth', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const username = process.env.INVENTREE_USERNAME || 'admin';
    const password = process.env.INVENTREE_PASSWORD || 'Inventree-QA-2026!';

    expect(username.length).toBeGreaterThan(0);
    expect(password.length).toBeGreaterThan(0);

    await loginPage.navigate();
    await loginPage.fillCredentials(username, password);
    await loginPage.submit();

    await expect(page).toHaveURL(/\/web\/(home|part|index)/);
    await expect(page.getByRole('button', { name: new RegExp(username, 'i') }).first()).toBeVisible();
  });

  baseTest('TC-UI-046: Auth — Login With Invalid Credentials @negative @auth', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.fillCredentials('invalid_user_9999', 'WrongPassword123!');
    await loginPage.submit();

    await expect(page).toHaveURL(/\/login/);
    const errorText = await loginPage.getErrorMessage();
    expect(errorText.length).toBeGreaterThan(0);
  });

  baseTest('TC-UI-047: Auth — Access Protected Page While Logged Out @auth @negative @smoke', async ({
    page,
  }) => {
    await page.goto('/web/part/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
  });

  baseTest('TC-UI-048: Auth — Logout Clears Session @auth @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const username = process.env.INVENTREE_USERNAME || 'admin';
    const password = process.env.INVENTREE_PASSWORD || 'Inventree-QA-2026!';

    await loginPage.navigate();
    await loginPage.fillCredentials(username, password);
    await loginPage.submit();
    await expect(page).toHaveURL(/\/web\/(home|part|index)/);

    // Click user avatar / profile menu and logout
    const userMenuButton = page.getByRole('button', { name: new RegExp(username, 'i') }).first();
    await userMenuButton.waitFor({ state: 'visible', timeout: 10_000 });
    await userMenuButton.click();

    const logoutItem = page.getByRole('menuitem', { name: /log out|logout|sign out/i }).or(page.getByText(/log out/i)).first();
    await logoutItem.waitFor({ state: 'visible', timeout: 5_000 });
    await logoutItem.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
