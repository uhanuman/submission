/**
 * part-read.api.spec.ts
 *
 * API automation for Part Read operations (FA-007, FA-008, FA-012).
 * Covers TC-API-041 through TC-API-052, plus TC-API-079 and TC-API-080.
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

/**
 * @group FA-007, FA-008, FA-012
 * Tests for GET /api/part/ and GET /api/part/{id}/
 */
test.describe('FA-007/FA-008/FA-012 · Part Read & Search', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;
  let categoryId: number;
  /** IDs of parts created for this suite */
  const createdPartIds: number[] = [];

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );

    // Seed category
    const catRes = await client.createCategory({ name: uniqueName('ReadCat') });
    expect(catRes.status()).toBe(201);
    const catData: Category = await catRes.json();
    categoryId = (catData.pk ?? catData.id)!;

    // Seed 12 active parts and 2 inactive parts so pagination tests work
    for (let i = 1; i <= 12; i++) {
      const res = await client.createPart({
        name: uniqueName(`Active-Part-${i}`),
        category: categoryId,
        active: true,
        IPN: `RD-ACTIVE-${i}-${Date.now()}`,
      });
      if (res.status() === 201) {
        const d: Part = await res.json();
        createdPartIds.push((d.pk ?? d.id)!);
      }
    }
    for (let i = 1; i <= 2; i++) {
      const res = await client.createPart({
        name: uniqueName(`Inactive-Part-${i}`),
        category: categoryId,
        active: false,
      });
      if (res.status() === 201) {
        const d: Part = await res.json();
        createdPartIds.push((d.pk ?? d.id)!);
      }
    }
    // Seed a part with a known searchable name
    const searchRes = await client.createPart({
      name: `Resistor-Search-${Date.now()}`,
      category: categoryId,
      active: true,
    });
    if (searchRes.status() === 201) {
      const d: Part = await searchRes.json();
      createdPartIds.push((d.pk ?? d.id)!);
    }
  });

  test.afterAll(async () => {
    for (const id of createdPartIds) {
      await client.safeDeletePart(id);
    }
    await client.safeDeleteCategory(categoryId);
    await requestContext?.dispose();
  });

  // ── Part List ──────────────────────────────────────────────────────────────

  test('TC-API-041: List all parts returns 200 with paginated envelope @smoke @regression', async () => {
    const response = await client.listParts({ limit: '25' });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('next');
    expect(data).toHaveProperty('previous');
    expect(Array.isArray(data.results)).toBe(true);
    if (data.results.length > 0) {
      const first = data.results[0];
      expect(first).toHaveProperty('pk');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('active');
    }
  });

  test('TC-API-042: Pagination — limit and offset return non-overlapping pages @regression @boundary', async () => {
    await test.step('GET page 1 with limit=5', async () => {
      const page1 = await client.listParts({ limit: '5', offset: '0' });
      expect(page1.status()).toBe(200);
      const d1 = await page1.json();
      expect(d1.results.length).toBeLessThanOrEqual(5);

      if (d1.count > 5) {
        const page2 = await client.listParts({ limit: '5', offset: '5' });
        expect(page2.status()).toBe(200);
        const d2 = await page2.json();

        const ids1: number[] = d1.results.map((p: Part) => p.pk ?? p.id);
        const ids2: number[] = d2.results.map((p: Part) => p.pk ?? p.id);
        const overlap = ids1.filter((id) => ids2.includes(id));
        expect(overlap.length).toBe(0);
      }
    });
  });

  // ── Part Search & Filter ───────────────────────────────────────────────────

  test('TC-API-043: Filter by category ID returns only parts in that category @regression', async () => {
    const response = await client.listParts({ category: String(categoryId) });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
    for (const part of results) {
      // category may be an object or integer depending on InvenTree version
      const catVal = typeof part.category === 'object' ? part.category?.pk : part.category;
      expect(catVal).toBe(categoryId);
    }
  });

  test('TC-API-044: Filter active=true returns only active parts @regression', async () => {
    const response = await client.listParts({ active: 'true', category: String(categoryId) });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
    for (const part of results) {
      expect(part.active).toBe(true);
    }
  });

  test('TC-API-045: Filter active=false returns only inactive parts @regression', async () => {
    const response = await client.listParts({ active: 'false', category: String(categoryId) });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
    for (const part of results) {
      expect(part.active).toBe(false);
    }
  });

  test('TC-API-046: Search by name keyword returns matching parts @regression', async () => {
    const response = await client.listParts({
      search: 'Resistor-Search',
      category: String(categoryId),
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    for (const part of results) {
      const nameOrIPN = `${part.name ?? ''} ${part.IPN ?? ''}`.toLowerCase();
      expect(nameOrIPN).toContain('resistor-search');
    }
  });

  test('TC-API-047: Search with no match returns 200 and empty results @boundary @negative', async () => {
    const response = await client.listParts({ search: 'XYZNOTEXIST_9999999' });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    const count = Array.isArray(data) ? data.length : data.count;
    expect(count).toBe(0);
    expect(results).toHaveLength(0);
  });

  test('TC-API-048: Combined filters (category + active + search) return intersection @regression @boundary', async () => {
    const response = await client.listParts({
      category: String(categoryId),
      active: 'true',
      search: 'Active-Part',
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results;
    expect(Array.isArray(results)).toBe(true);
    for (const part of results) {
      expect(part.active).toBe(true);
    }
  });

  test('TC-API-079: Large offset beyond count returns 200 with empty results @boundary @regression', async () => {
    const response = await client.listParts({ limit: '10', offset: '100000' });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.results).toHaveLength(0);
    expect(typeof data.count).toBe('number');
  });

  test('TC-API-080: Case-insensitive search matches parts @regression @boundary', async () => {
    const lower = await client.listParts({
      search: 'resistor-search',
      category: String(categoryId),
    });
    expect(lower.status()).toBe(200);
    const dataLower = await lower.json();

    const upper = await client.listParts({
      search: 'RESISTOR-SEARCH',
      category: String(categoryId),
    });
    expect(upper.status()).toBe(200);
    const dataUpper = await upper.json();

    const countLower = Array.isArray(dataLower) ? dataLower.length : dataLower.count;
    const countUpper = Array.isArray(dataUpper) ? dataUpper.length : dataUpper.count;
    // Both should return the same count (case-insensitive)
    expect(countLower).toBe(countUpper);
  });

  // ── Part Detail ────────────────────────────────────────────────────────────

  test('TC-API-049: Valid part ID returns 200 with all flag fields @smoke @regression', async () => {
    const partId = createdPartIds[0];
    const response = await client.getPart(partId);
    expect(response.status()).toBe(200);
    const data: Part = await response.json();
    expect(data.pk ?? data.id).toBe(partId);
    expect(typeof data.name).toBe('string');
    expect(typeof data.active).toBe('boolean');
    expect(data).toHaveProperty('purchaseable');
    expect((data.salable ?? data.saleable) !== undefined).toBe(true);
    expect(data).toHaveProperty('trackable');
    expect(data).toHaveProperty('virtual');
  });

  test('TC-API-050: Non-existent part ID returns 404 @negative @smoke', async () => {
    const response = await client.getPart(999_999);
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-051: Non-numeric part ID returns 404 @negative @boundary', async () => {
    const response = await client.getPart('abc');
    expect([404, 400]).toContain(response.status());
  });

  test('TC-API-052: Part detail includes all required flag fields @regression', async () => {
    const partId = createdPartIds[0];
    const response = await client.getPart(partId);
    expect(response.status()).toBe(200);
    const data: Part = await response.json();
    // Confirm boolean flag fields exist
    expect(typeof data.purchaseable).toBe('boolean');
    expect(typeof (data.salable ?? data.saleable)).toBe('boolean');
    expect(typeof data.trackable).toBe('boolean');
    expect(typeof data.virtual).toBe('boolean');
    // minimum_stock and units may be null but must exist
    expect(data).toHaveProperty('minimum_stock');
    expect(data).toHaveProperty('units');
  });
});
