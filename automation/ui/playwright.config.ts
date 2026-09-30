import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from automation/ui/.env first, then allow process.env overrides
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.ui.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.INVENTREE_BASE_URL || 'http://localhost:8000',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  timeout: 60_000,
  projects: [
    {
      name: 'ui-tests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
