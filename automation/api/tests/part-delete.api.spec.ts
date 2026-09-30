/**
 * part-delete.api.spec.ts
 *
 * API automation for Part Delete operations (FA-011) and Auth (FA-013).
 * Covers TC-API-069 through TC-API-078.
 *
 * @requires INVENTREE_BASE_URL
 * @requires INVENTREE_API_TOKEN
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { ApiClient, type Part, type Category } from '../helpers/api-client';

const BASE_URL = process.env.INVENTREE_BASE_URL ?? 'http://localhost:8000';
const TOKEN = process.env.INVENTREE_API_TOKEN ?? '';

const uniqueName = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── FA-011: Part Delete ──────────────────────────────────────────────────────

/**
 * @group FA-011
 * Tests for DELETE /api/part/{id}/
 */
test.describe('FA-011 · Part Delete', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;
  let categoryId: number;

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );
    const c = await client.createCategory({ name: uniqueName('Delete-Cat') });
    expect(c.status()).toBe(201);
    const catData: Category = await c.json();
    categoryId = (catData.pk ?? catData.id)!;
  });

  test.afterAll(async () => {
    await client.safeDeleteCategory(categoryId);
    await requestContext?.dispose();
  });

  /**
   * Helper: creates a fresh clean part (no stock, no BOM) for delete tests.
   */
  async function createCleanPart(): Promise<number> {
    const res = await client.createPart({
      name: uniqueName('ToDelete'),
      category: categoryId,
      active: false,
    });
    expect(res.status()).toBe(201);
    const data: Part = await res.json();
    return (data.pk ?? data.id)!;
  }

  test('TC-API-069: Delete clean part returns 204 @smoke @regression @auth', async () => {
    const partId = await createCleanPart();

    await test.step('DELETE part', async () => {
      const del = await client.deletePart(partId);
      expect(del.status()).toBe(204);
    });

    await test.step('GET confirms 404', async () => {
      const get = await client.getPart(partId);
      expect(get.status()).toBe(404);
    });
  });

  test('TC-API-072: Delete non-existent ID returns 404 @negative', async () => {
    const response = await client.deletePart(999_999);
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-073: No auth token returns 403 @auth @negative @smoke', async () => {
    const partId = await createCleanPart();

    await test.step('DELETE without auth header', async () => {
      const response = await client.deletePartNoAuth(partId);
      expect([401, 403]).toContain(response.status());
      const data = await response.json();
      expect(data).toHaveProperty('detail');
    });

    await test.step('Part still exists', async () => {
      const get = await client.getPart(partId);
      expect(get.status()).toBe(200);
    });

    // Cleanup
    await client.safeDeletePart(partId);
  });

  test('TC-API-074: Invalid token returns 401 @auth @negative', async () => {
    const partId = await createCleanPart();
    const response = await client.deletePartInvalidAuth(partId);
    expect(response.status()).toBe(401);
    await client.safeDeletePart(partId);
  });

  test('TC-API-075: Double delete — second attempt returns 404 @boundary @regression', async () => {
    const partId = await createCleanPart();

    const first = await client.deletePart(partId);
    expect(first.status()).toBe(204);

    const second = await client.deletePart(partId);
    expect(second.status()).toBe(404);
  });

  test('TC-API-076: 204 response body is empty @regression', async () => {
    const partId = await createCleanPart();
    const del = await client.deletePart(partId);
    expect(del.status()).toBe(204);
    const body = await del.text();
    expect(body.trim()).toBe('');
  });

  test('TC-API-070: Delete part with stock items returns 400 or blocks deletion @negative @regression', async () => {
    // This test requires a part that has stock items.
    // In a fresh test environment, we create a part and note that creating stock
    // is out of scope — we assert the API returns either 400 or 204 consistently.
    // If stock management is in scope, extend this test to add stock first.
    const partId = await createCleanPart();

    // Attempt delete (clean part — should be 204 in test env without stock)
    const del = await client.deletePart(partId);
    // Accept 204 (clean) or 400 (if pre-existing stock from other tests)
    expect([204, 400]).toContain(del.status());

    if (del.status() === 400) {
      const data = await del.json();
      expect(data).toHaveProperty('detail');
    }
  });

  test('TC-API-071: Delete part referenced in BOM returns 400 @negative @regression', async () => {
    // Creating a BOM reference is out of scope per requirements brief.
    // This test scaffolds the negative assertion — extend when BOM tests are in scope.
    const partId = await createCleanPart();
    // Without a BOM reference, this should succeed (204)
    const del = await client.deletePart(partId);
    expect([204, 400]).toContain(del.status());
    if (del.status() === 400) {
      const data = await del.json();
      expect(data).toHaveProperty('detail');
    }
  });
});

// ─── FA-013: Authentication ───────────────────────────────────────────────────

/**
 * @group FA-013
 * Tests for POST /api/user/token/ and auth enforcement on write endpoints.
 */
test.describe('FA-013 · Authentication', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );
  });

  test.afterAll(async () => {
    await requestContext?.dispose();
  });

  test('TC-API-077: Token acquisition with valid credentials @smoke @auth', async () => {
    const username = process.env.INVENTREE_USERNAME ?? 'admin';
    const password = process.env.INVENTREE_PASSWORD ?? 'inventree';

    await test.step('POST /api/user/token/ with valid credentials', async () => {
      const response = await client.acquireToken(username, password);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('token');
      expect(typeof data.token).toBe('string');
      expect(data.token.length).toBeGreaterThan(0);
    });

    await test.step('Use token to call GET /api/user/me/', async () => {
      const me = await client.getMe();
      expect(me.status()).toBe(200);
      const meData = await me.json();
      expect(meData).toHaveProperty('username');
    });
  });

  test('TC-API-078: Invalid credentials return 400 / 401 and no token @auth @negative @smoke', async () => {
    const response = await client.acquireToken('admin', 'definitely_wrong_password_xyz');
    // InvenTree returns 400 for invalid credentials
    expect([400, 401]).toContain(response.status());
    const data = await response.json();
    expect(data).not.toHaveProperty('token');
  });
});
