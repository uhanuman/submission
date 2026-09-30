/**
 * part-update.api.spec.ts
 *
 * API automation for Part Update operations — full PUT (FA-009) and PATCH (FA-010).
 * Covers TC-API-053 through TC-API-068.
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

const uniqueIPN = (): string =>
  `IPN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

// ─── FA-009: Part Update — Full PUT ──────────────────────────────────────────

/**
 * @group FA-009
 * Tests for PUT /api/part/{id}/
 */
test.describe('FA-009 · Part Update (Full PUT)', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;
  let categoryId: number;
  let category2Id: number;
  let partId: number;
  let partIPN: string;

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );

    // Seed categories
    const c1 = await client.createCategory({ name: uniqueName('PUT-Cat1') });
    const c1Data: Category = await c1.json();
    categoryId = (c1Data.pk ?? c1Data.id)!;

    const c2 = await client.createCategory({ name: uniqueName('PUT-Cat2') });
    const c2Data: Category = await c2.json();
    category2Id = (c2Data.pk ?? c2Data.id)!;

    // Seed part
    partIPN = uniqueIPN();
    const p = await client.createPart({
      name: uniqueName('PUT-Part'),
      category: categoryId,
      IPN: partIPN,
      active: true,
      purchaseable: true,
    });
    expect(p.status()).toBe(201);
    const pd: Part = await p.json();
    partId = (pd.pk ?? pd.id)!;

    // Ensure duplicate IPN rejection is enforced
    await client.setGlobalSetting('PART_ALLOW_DUPLICATE_IPN', false);
  });

  test.afterAll(async () => {
    await client.safeDeletePart(partId);
    await client.safeDeleteCategory(categoryId);
    await client.safeDeleteCategory(category2Id);
    await requestContext?.dispose();
  });

  test('TC-API-053: Full PUT update returns 200 with updated fields @smoke @regression @auth', async () => {
    const newName = uniqueName('PUT-Updated');

    await test.step('PUT with complete payload', async () => {
      const response = await client.updatePart(partId, {
        name: newName,
        description: 'Updated description',
        category: categoryId,
        active: true,
        purchaseable: true,
        saleable: false,
        trackable: false,
        virtual: false,
      });
      expect(response.status()).toBe(200);
      const data: Part = await response.json();
      expect(data.name).toBe(newName);
      expect(data.description).toBe('Updated description');
    });

    await test.step('GET to confirm persistence', async () => {
      const get = await client.getPart(partId);
      expect(get.status()).toBe(200);
      const got: Part = await get.json();
      expect(got.name).toBe(newName);
    });
  });

  test('TC-API-054: PUT without name returns 400 @negative @regression', async () => {
    const response = await client.updatePart(partId, {
      description: 'No name',
      category: categoryId,
    } as Partial<Part>);
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('name');
  });

  test('TC-API-055: PUT with invalid category ID returns 400 @negative @regression', async () => {
    const response = await client.updatePart(partId, {
      name: uniqueName('Invalid-Cat'),
      category: 999_999,
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('category');
  });

  test('TC-API-056: PUT with duplicate IPN returns 400 @negative @boundary', async () => {
    // Create a second part with a different IPN
    const ipn2 = uniqueIPN();
    const p2 = await client.createPart({
      name: uniqueName('PUT-Part2'),
      category: categoryId,
      IPN: ipn2,
    });
    expect(p2.status()).toBe(201);
    const p2d: Part = await p2.json();
    const p2Id = (p2d.pk ?? p2d.id)!;

    // Now try to set partId's IPN to ipn2 (already used by p2)
    const response = await client.updatePart(partId, {
      name: uniqueName('PUT-DupIPN'),
      category: categoryId,
      IPN: ipn2,
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('IPN');

    // Cleanup second part
    await client.safeDeletePart(p2Id);
  });

  test('TC-API-057: PUT on non-existent part ID returns 404 @negative', async () => {
    const response = await client.updatePart(999_999, {
      name: 'Ghost',
      category: categoryId,
    });
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-058: No auth token returns 403 @auth @negative @smoke', async () => {
    const originalGet = await client.getPart(partId);
    const original: Part = await originalGet.json();

    const response = await client.updatePartNoAuth(partId, {
      name: 'Unauthorized Update',
      category: categoryId,
    });
    expect([401, 403]).toContain(response.status());

    // Verify part unchanged
    const verify = await client.getPart(partId);
    const verified: Part = await verify.json();
    expect(verified.name).toBe(original.name);
  });

  test('TC-API-059: Omitting boolean flag in PUT maintains valid boolean state @boundary @regression', async () => {
    // First set purchaseable=true
    await client.updatePart(partId, {
      name: uniqueName('FlagDefault'),
      category: categoryId,
      purchaseable: true,
    });

    // Now PUT without purchaseable field — should maintain valid boolean state
    const response = await client.updatePart(partId, {
      name: uniqueName('FlagDefault2'),
      category: categoryId,
      // purchaseable intentionally omitted
    });
    expect(response.status()).toBe(200);
    const data: Part = await response.json();
    expect(typeof data.purchaseable).toBe('boolean');
  });

  test('TC-API-060: Invalid token returns 401 @auth @negative', async () => {
    const response = await client.updatePartInvalidAuth(partId, {
      name: 'Bad Token Update',
      category: categoryId,
    });
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });
});

// ─── FA-010: Part Update — Partial PATCH ─────────────────────────────────────

/**
 * @group FA-010
 * Tests for PATCH /api/part/{id}/
 */
test.describe('FA-010 · Part Update (PATCH)', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;
  let categoryId: number;
  let partId: number;
  let originalName: string;

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );

    const c = await client.createCategory({ name: uniqueName('PATCH-Cat') });
    const cData: Category = await c.json();
    categoryId = (cData.pk ?? cData.id)!;

    originalName = uniqueName('PATCH-Part');
    const p = await client.createPart({
      name: originalName,
      category: categoryId,
      active: true,
      purchaseable: true,
    });
    expect(p.status()).toBe(201);
    const pd: Part = await p.json();
    partId = (pd.pk ?? pd.id)!;

    // Ensure duplicate IPN rejection is enforced
    await client.setGlobalSetting('PART_ALLOW_DUPLICATE_IPN', false);
  });

  test.afterAll(async () => {
    await client.safeDeletePart(partId);
    await client.safeDeleteCategory(categoryId);
    await requestContext?.dispose();
  });

  test('TC-API-061: PATCH single field updates only that field @smoke @regression @auth', async () => {
    const newDesc = 'Patched description only';

    await test.step('PATCH description only', async () => {
      const response = await client.patchPart(partId, { description: newDesc });
      expect(response.status()).toBe(200);
      const data: Part = await response.json();
      expect(data.description).toBe(newDesc);
      // Name should be unchanged
      expect(data.name).toBe(originalName);
    });
  });

  test('TC-API-062: PATCH active=false sets part inactive @regression', async () => {
    await test.step('PATCH active to false', async () => {
      const response = await client.patchPart(partId, { active: false });
      expect(response.status()).toBe(200);
      const data: Part = await response.json();
      expect(data.active).toBe(false);
    });

    await test.step('GET confirms part still accessible but inactive', async () => {
      const get = await client.getPart(partId);
      expect(get.status()).toBe(200);
      const got: Part = await get.json();
      expect(got.active).toBe(false);
    });

    // Restore active=true for subsequent tests
    await client.patchPart(partId, { active: true });
  });

  test('TC-API-063: PATCH with empty body is a no-op returning 200 @boundary @regression', async () => {
    const before = await client.getPart(partId);
    const beforeData: Part = await before.json();

    const response = await client.patchPart(partId, {});
    expect(response.status()).toBe(200);
    const after: Part = await response.json();

    expect(after.name).toBe(beforeData.name);
    expect(after.active).toBe(beforeData.active);
  });

  test('TC-API-064: PATCH with duplicate IPN returns 400 @negative @boundary', async () => {
    // Create a second part with a different IPN
    const ipn = uniqueIPN();
    const p2 = await client.createPart({
      name: uniqueName('PATCH-Part2'),
      category: categoryId,
      IPN: ipn,
    });
    expect(p2.status()).toBe(201);
    const p2d: Part = await p2.json();
    const p2Id = (p2d.pk ?? p2d.id)!;

    // Attempt to PATCH partId with duplicate IPN
    const response = await client.patchPart(partId, { IPN: ipn });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('IPN');

    await client.safeDeletePart(p2Id);
  });

  test('TC-API-065: PATCH on non-existent part ID returns 404 @negative', async () => {
    const response = await client.patchPart(999_999, { description: 'Ghost PATCH' });
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-066: No auth token returns 403 @auth @negative @smoke', async () => {
    const response = await client.patchPartNoAuth(partId, { description: 'Unauthorized PATCH' });
    expect([401, 403]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-067: Invalid token returns 401 @auth @negative', async () => {
    const response = await client.patchPartInvalidAuth(partId, { description: 'Bad token PATCH' });
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-068: PATCH multiple fields updates all supplied fields @regression', async () => {
    const newName = uniqueName('Multi-PATCH');
    const response = await client.patchPart(partId, {
      name: newName,
      description: 'Multi-field PATCH',
    });
    expect(response.status()).toBe(200);
    const data: Part = await response.json();
    expect(data.name).toBe(newName);
    expect(data.description).toBe('Multi-field PATCH');

    // Update our local record
    originalName = newName;
  });
});
