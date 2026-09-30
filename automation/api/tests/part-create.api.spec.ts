/**
 * part-create.api.spec.ts
 *
 * API automation for Part Create operations (FA-006).
 * Covers TC-API-033 through TC-API-040.
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

const uniqueIPN = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}`;

/**
 * @group FA-006
 * Tests for POST /api/part/
 */
test.describe('FA-006 · Part Create', () => {
  let client: ApiClient;
  let requestContext: APIRequestContext;
  let categoryId: number;
  const createdPartIds: number[] = [];

  test.beforeAll(async ({ playwright }) => {
    requestContext = await playwright.request.newContext();
    client = new ApiClient(
      requestContext,
      process.env.INVENTREE_BASE_URL ?? BASE_URL,
      process.env.INVENTREE_API_TOKEN ?? TOKEN
    );
    // Create a category to use as the FK for all part create tests
    const catRes = await client.createCategory({ name: uniqueName('PartCreate-Cat') });
    expect(catRes.status()).toBe(201);
    const catData: Category = await catRes.json();
    categoryId = (catData.pk ?? catData.id)!;

    // Ensure duplicate IPN rejection is enforced
    await client.setGlobalSetting('PART_ALLOW_DUPLICATE_IPN', false);
  });

  test.afterAll(async () => {
    for (const id of createdPartIds) {
      await client.safeDeletePart(id);
    }
    await client.safeDeleteCategory(categoryId);
    await requestContext?.dispose();
  });

  test('TC-API-033: Create part with all required fields returns 201 @smoke @regression @auth', async () => {
    const partName = uniqueName('Resistor-10K');

    await test.step('POST /api/part/ with valid payload', async () => {
      const response = await client.createPart({
        name: partName,
        description: '10K Ohm resistor 0805',
        category: categoryId,
        active: true,
        purchaseable: true,
        saleable: false,
        trackable: false,
      });
      expect(response.status()).toBe(201);
      const data: Part = await response.json();
      expect(data).toMatchObject({ name: partName, active: true });
      expect(data.pk ?? data.id).toBeDefined();
      expect(typeof (data.pk ?? data.id)).toBe('number');
      createdPartIds.push((data.pk ?? data.id)!);
    });
  });

  test('TC-API-034: Create part with unique IPN returns 201 @regression @auth', async () => {
    const ipn = uniqueIPN('R-10K-0805');
    const response = await client.createPart({
      name: uniqueName('Resistor-IPN'),
      description: 'With IPN',
      category: categoryId,
      IPN: ipn,
      active: true,
    });
    expect(response.status()).toBe(201);
    const data: Part = await response.json();
    expect(data.IPN).toBe(ipn);
    createdPartIds.push((data.pk ?? data.id)!);
  });

  test('TC-API-035: Missing name returns 400 @negative @regression', async () => {
    const response = await client.createPart({
      description: 'No name',
      category: categoryId,
    } as Partial<Part>);
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('name');
  });

  test('TC-API-036: Missing category returns 400 or creates root part with null category @negative @regression', async () => {
    const response = await client.createPart({
      name: uniqueName('NoCat'),
      description: 'Missing category',
    } as Partial<Part>);
    if (response.status() === 201) {
      const data: Part = await response.json();
      createdPartIds.push((data.pk ?? data.id)!);
      expect(data.category).toBeNull();
    } else {
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('category');
    }
  });

  test('TC-API-037: Duplicate IPN returns 400 @negative @regression', async () => {
    const ipn = uniqueIPN('DUP-IPN');
    // Create first part with this IPN
    const first = await client.createPart({
      name: uniqueName('First-IPN'),
      category: categoryId,
      IPN: ipn,
    });
    expect(first.status()).toBe(201);
    createdPartIds.push(((await first.json()) as Part).pk!);

    // Attempt duplicate
    const second = await client.createPart({
      name: uniqueName('Second-IPN'),
      category: categoryId,
      IPN: ipn,
    });
    expect(second.status()).toBe(400);
    const data = await second.json();
    expect(data).toHaveProperty('IPN');
  });

  test('TC-API-038: Invalid (non-existent) category ID returns 400 @negative @regression', async () => {
    const response = await client.createPart({
      name: uniqueName('InvalidCat'),
      category: 999_999,
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('category');
  });

  test('TC-API-039: No auth token returns 403 @auth @negative @smoke', async () => {
    const response = await client.createPartNoAuth({
      name: uniqueName('UnauthorizedPart'),
      category: categoryId,
    });
    expect([401, 403]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('TC-API-040: active flag defaults to true when omitted @boundary @regression', async () => {
    const response = await client.createPart({
      name: uniqueName('DefaultActive'),
      category: categoryId,
      // active intentionally omitted
    });
    expect(response.status()).toBe(201);
    const data: Part = await response.json();
    expect(data.active).toBe(true);
    createdPartIds.push((data.pk ?? data.id)!);
  });
});
