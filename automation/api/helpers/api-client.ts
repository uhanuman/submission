import type { APIRequestContext, APIResponse } from '@playwright/test';

// ─── Domain Types ──────────────────────────────────────────────────────────────

/** Represents a Part Category in InvenTree */
export interface Category {
  id?: number;
  pk?: number;
  name: string;
  description?: string;
  parent?: number | null;
  pathstring?: string;
  part_count?: number;
}

/** Represents a Part in InvenTree */
export interface Part {
  id?: number;
  pk?: number;
  name: string;
  description?: string;
  /** Internal Part Number — must be globally unique */
  IPN?: string;
  category?: number | null;
  active?: boolean;
  purchaseable?: boolean;
  saleable?: boolean;
  salable?: boolean;
  trackable?: boolean;
  virtual?: boolean;
  units?: string;
  minimum_stock?: number;
}

/** Paginated list response envelope from InvenTree REST API */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── ApiClient ─────────────────────────────────────────────────────────────────

/**
 * Shared API client for the InvenTree REST API.
 *
 * Wraps Playwright's `APIRequestContext` and injects the auth token header
 * on every write request.  Read operations also carry the token so that
 * private InvenTree instances (which require auth on GETs) work correctly.
 *
 * @example
 * const client = new ApiClient(request, process.env.INVENTREE_BASE_URL!, process.env.INVENTREE_API_TOKEN!);
 * const res = await client.createPart({ name: 'Resistor', category: 1 });
 * expect(res.status()).toBe(201);
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext, baseUrl: string, token: string) {
    this.request = request;
    // Strip trailing slash for consistency
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Builds the full URL from a relative path */
  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** Auth header for authenticated requests */
  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Token ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /** Headers for unauthenticated requests (used in auth-failure tests) */
  static noAuthHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json' };
  }

  /** Headers with an invalid / expired token */
  static invalidTokenHeaders(): Record<string, string> {
    return {
      Authorization: 'Token invalid_token_xyz_abc_123',
      'Content-Type': 'application/json',
    };
  }

  // ── Part Category Endpoints ────────────────────────────────────────────────

  /**
   * POST /api/part/category/
   * Creates a new Part Category.  Requires authentication.
   */
  async createCategory(data: Partial<Category>): Promise<APIResponse> {
    return this.request.post(this.url('/api/part/category/'), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * POST /api/part/category/  — without auth token (for negative tests)
   */
  async createCategoryNoAuth(data: Partial<Category>): Promise<APIResponse> {
    return this.request.post(this.url('/api/part/category/'), {
      headers: ApiClient.noAuthHeaders(),
      data,
    });
  }

  /**
   * POST /api/part/category/  — with an invalid token (for auth failure tests)
   */
  async createCategoryInvalidAuth(data: Partial<Category>): Promise<APIResponse> {
    return this.request.post(this.url('/api/part/category/'), {
      headers: ApiClient.invalidTokenHeaders(),
      data,
    });
  }

  /**
   * GET /api/part/category/
   * Lists all Part Categories. Accepts optional query parameters (e.g. parent).
   */
  async listCategories(params?: Record<string, string>): Promise<APIResponse> {
    const queryParams: Record<string, string> = { ...params };
    if (queryParams.parent === 'null') {
      delete queryParams.parent;
      queryParams.cascade = 'false';
    }
    return this.request.get(this.url('/api/part/category/'), {
      headers: this.authHeaders,
      params: queryParams,
    });
  }

  /**
   * GET /api/part/category/{id}/
   * Retrieves the detail of a single Part Category by ID.
   */
  async getCategory(id: number | string): Promise<APIResponse> {
    return this.request.get(this.url(`/api/part/category/${id}/`), {
      headers: this.authHeaders,
    });
  }

  /**
   * PUT /api/part/category/{id}/
   * Full replacement update of a Part Category.  Requires authentication.
   */
  async updateCategory(id: number, data: Partial<Category>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/category/${id}/`), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * PUT /api/part/category/{id}/  — without auth (for negative tests)
   */
  async updateCategoryNoAuth(id: number, data: Partial<Category>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/category/${id}/`), {
      headers: ApiClient.noAuthHeaders(),
      data,
    });
  }

  /**
   * PUT /api/part/category/{id}/  — with invalid token
   */
  async updateCategoryInvalidAuth(id: number, data: Partial<Category>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/category/${id}/`), {
      headers: ApiClient.invalidTokenHeaders(),
      data,
    });
  }

  /**
   * DELETE /api/part/category/{id}/
   * Deletes a Part Category. Returns 204 on success.
   */
  async deleteCategory(
    id: number,
    data: object = { delete_child_categories: false, delete_parts: false }
  ): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/category/${id}/`), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * DELETE /api/part/category/{id}/  — without auth
   */
  async deleteCategoryNoAuth(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/category/${id}/`), {
      headers: {},
    });
  }

  /**
   * DELETE /api/part/category/{id}/  — with invalid token
   */
  async deleteCategoryInvalidAuth(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/category/${id}/`), {
      headers: { Authorization: 'Token invalid_token' },
    });
  }

  // ── Part Endpoints ─────────────────────────────────────────────────────────

  /**
   * POST /api/part/
   * Creates a new Part.  Requires authentication.
   */
  async createPart(data: Partial<Part>): Promise<APIResponse> {
    return this.request.post(this.url('/api/part/'), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * POST /api/part/  — without auth
   */
  async createPartNoAuth(data: Partial<Part>): Promise<APIResponse> {
    return this.request.post(this.url('/api/part/'), {
      headers: ApiClient.noAuthHeaders(),
      data,
    });
  }

  /**
   * GET /api/part/
   * Lists all Parts with optional query filters (category, active, search, limit, offset).
   */
  async listParts(params?: Record<string, string>): Promise<APIResponse> {
    return this.request.get(this.url('/api/part/'), {
      headers: this.authHeaders,
      params,
    });
  }

  /**
   * GET /api/part/{id}/
   * Retrieves the detail of a single Part by ID.
   */
  async getPart(id: number | string): Promise<APIResponse> {
    return this.request.get(this.url(`/api/part/${id}/`), {
      headers: this.authHeaders,
    });
  }

  /**
   * PUT /api/part/{id}/
   * Full replacement update of a Part.  Requires authentication.
   */
  async updatePart(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/${id}/`), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * PUT /api/part/{id}/  — without auth
   */
  async updatePartNoAuth(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/${id}/`), {
      headers: ApiClient.noAuthHeaders(),
      data,
    });
  }

  /**
   * PUT /api/part/{id}/  — with invalid token
   */
  async updatePartInvalidAuth(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.put(this.url(`/api/part/${id}/`), {
      headers: ApiClient.invalidTokenHeaders(),
      data,
    });
  }

  /**
   * PATCH /api/part/{id}/
   * Partial update of a Part.  Only supplied fields are modified.
   */
  async patchPart(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.patch(this.url(`/api/part/${id}/`), {
      headers: this.authHeaders,
      data,
    });
  }

  /**
   * PATCH /api/part/{id}/  — without auth
   */
  async patchPartNoAuth(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.patch(this.url(`/api/part/${id}/`), {
      headers: ApiClient.noAuthHeaders(),
      data,
    });
  }

  /**
   * PATCH /api/part/{id}/  — with invalid token
   */
  async patchPartInvalidAuth(id: number, data: Partial<Part>): Promise<APIResponse> {
    return this.request.patch(this.url(`/api/part/${id}/`), {
      headers: ApiClient.invalidTokenHeaders(),
      data,
    });
  }

  /**
   * DELETE /api/part/{id}/
   * Deletes a Part.  Returns 204 on success.
   */
  async deletePart(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/${id}/`), {
      headers: this.authHeaders,
    });
  }

  /**
   * DELETE /api/part/{id}/  — without auth
   */
  async deletePartNoAuth(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/${id}/`), {
      headers: {},
    });
  }

  /**
   * DELETE /api/part/{id}/  — with invalid token
   */
  async deletePartInvalidAuth(id: number): Promise<APIResponse> {
    return this.request.delete(this.url(`/api/part/${id}/`), {
      headers: { Authorization: 'Token bad_one' },
    });
  }

  // ── Authentication Endpoints ───────────────────────────────────────────────

  /**
   * GET /api/user/me/token/
   * Requests an API token using HTTP Basic authentication as documented in:
   * https://docs.inventree.org/en/stable/api/#requesting-a-token
   */
  async requestToken(username: string, password: string): Promise<APIResponse> {
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    return this.request.get(this.url('/api/user/me/token/'), {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });
  }

  /**
   * Acquires an API token using username + password credentials via /api/user/me/token/
   */
  async acquireToken(username: string, password: string): Promise<APIResponse> {
    return this.requestToken(username, password);
  }

  /**
   * GET /api/user/me/
   * Returns details of the authenticated user.
   */
  async getMe(): Promise<APIResponse> {
    return this.request.get(this.url('/api/user/me/'), {
      headers: this.authHeaders,
    });
  }

  /**
   * PATCH /api/settings/global/{key}/
   * Updates an InvenTree global setting.
   */
  async setGlobalSetting(key: string, value: any): Promise<APIResponse> {
    return this.request.patch(this.url(`/api/settings/global/${key}/`), {
      headers: this.authHeaders,
      data: { value },
    });
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /**
   * Safely deletes a Part, ignoring 404 errors.
   * Use in afterEach/afterAll cleanup blocks.
   */
  async safeDeletePart(id: number | undefined): Promise<void> {
    if (!id) return;
    try {
      await this.patchPart(id, { active: false });
      await this.deletePart(id);
    } catch {
      // Ignore — resource may already be gone
    }
  }

  /**
   * Safely deletes a Category, ignoring 404 errors.
   * Use in afterEach/afterAll cleanup blocks.
   */
  async safeDeleteCategory(id: number | undefined): Promise<void> {
    if (!id) return;
    try {
      await this.deleteCategory(id);
    } catch {
      // Ignore — resource may already be gone
    }
  }
}
