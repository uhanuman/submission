import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env (ignored by git)
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  /** Root directory for test files */
  testDir: './tests',

  /** Glob pattern for test files */
  testMatch: '**/*.api.spec.ts',

  /** Maximum time one test can run (ms) */
  timeout: 30_000,

  /** Fail the build on CI if tests are accidentally skipped */
  forbidOnly: !!process.env.CI,

  /** Retry failing tests once on CI */
  retries: process.env.CI ? 1 : 0,

  /** Run tests in parallel workers */
  workers: process.env.CI ? 2 : 4,

  /** Reporter */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    /** Base URL sourced from env — never hardcoded */
    baseURL: process.env.INVENTREE_BASE_URL ?? 'http://localhost:8000',

    /** Extra HTTP headers applied to every request */
    extraHTTPHeaders: {
      Accept: 'application/json',
    },

    /** Capture traces on first retry */
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'api-tests',
      use: {
        // No browser — pure HTTP API tests via Playwright's request context
      },
    },
  ],
});
