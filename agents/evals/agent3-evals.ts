/**
 * Agent 3 Evals — API Automation Engineer
 *
 * Structural: validates generated files JSON schema
 * Statistical: checks required files, security (no hardcoded secrets), coverage
 */

const REQUIRED_API_FILES = [
  "helpers/api-client.ts",
  "playwright.config.ts",
  "package.json",
  ".env.example",
];

const HARDCODED_SECRET_PATTERNS = [
  /password\s*=\s*['"][^'"]+['"]/gi,
  /token\s*=\s*['"][a-zA-Z0-9_-]{20,}['"]/gi,
  /localhost:\d{4}/g,       // hardcoded base URL
  /127\.0\.0\.1/g,          // hardcoded IP
  /Authorization:\s*Token\s+[a-zA-Z0-9_-]{10,}/gi,
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratedFile {
  path: string;
  content: string;
}

// ─── Structural Eval ─────────────────────────────────────────────────────────

export function runAgent3StructuralEval(output: unknown): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (typeof output !== "object" || output === null) {
    return { passed: false, issues: ["Output is not a JSON object"] };
  }

  const o = output as Record<string, unknown>;

  if (!Array.isArray(o.files)) {
    return { passed: false, issues: ['"files" property must be an array'] };
  }

  o.files.forEach((file: unknown, i: number) => {
    const f = file as Record<string, unknown>;
    if (typeof f.path !== "string" || f.path.trim() === "") {
      issues.push(`files[${i}] missing or empty "path"`);
    }
    if (typeof f.content !== "string" || f.content.trim() === "") {
      issues.push(`files[${i}] missing or empty "content" (path: "${f.path}")`);
    }
  });

  return { passed: issues.length === 0, issues };
}

// ─── Statistical Eval ────────────────────────────────────────────────────────

export function runAgent3StatisticalEval(output: unknown): {
  score: number;
  details: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const checks: boolean[] = [];

  const files: GeneratedFile[] = Array.isArray((output as Record<string, unknown>).files)
    ? ((output as Record<string, unknown>).files as GeneratedFile[])
    : [];

  const filePaths = files.map((f) => f.path);

  // Check 1: All required files present
  const missingFiles = REQUIRED_API_FILES.filter(
    (req) => !filePaths.some((p) => p.endsWith(req) || p === req)
  );
  const hasRequiredFiles = missingFiles.length === 0;
  checks.push(hasRequiredFiles);
  if (!hasRequiredFiles) {
    warnings.push(`Missing required files: ${missingFiles.join(", ")}`);
  }

  // Check 2: At least one spec file exists
  const specFiles = files.filter((f) => f.path.includes(".api.spec.ts"));
  checks.push(specFiles.length >= 1);
  if (specFiles.length === 0) {
    warnings.push("No .api.spec.ts files found in generated output");
  }

  // Check 3: No hardcoded secrets in any file
  const secretViolations: string[] = [];
  for (const file of files) {
    for (const pattern of HARDCODED_SECRET_PATTERNS) {
      const match = file.content.match(pattern);
      if (match) {
        secretViolations.push(`"${file.path}": found pattern "${match[0].slice(0, 40)}..."`);
      }
    }
  }
  checks.push(secretViolations.length === 0);
  if (secretViolations.length > 0) {
    warnings.push(`SECURITY: Hardcoded secrets found in ${secretViolations.length} files:`);
    secretViolations.forEach((v) => warnings.push(`  • ${v}`));
  }

  // Check 4: process.env usage present in generated files
  const allContent = files.map((f) => f.content).join("\n");
  const usesProcessEnv = allContent.includes("process.env.INVENTREE_BASE_URL") &&
    allContent.includes("process.env.INVENTREE_API_TOKEN");
  checks.push(usesProcessEnv);
  if (!usesProcessEnv) {
    warnings.push("process.env.INVENTREE_BASE_URL or INVENTREE_API_TOKEN not found — check configuration");
  }

  // Check 5: afterEach or afterAll cleanup hooks present
  const hasCleanup = allContent.includes("afterEach") || allContent.includes("afterAll");
  checks.push(hasCleanup);
  if (!hasCleanup) {
    warnings.push("No afterEach/afterAll cleanup hooks found — test isolation may be compromised");
  }

  // Check 6: expect(response.status()) assertions present
  const hasStatusAssert = allContent.includes("expect(response.status())") ||
    allContent.includes("expect(response.status).toBe");
  checks.push(hasStatusAssert);
  if (!hasStatusAssert) {
    warnings.push("No status code assertions found — API tests must assert response.status()");
  }

  // Check 7: toMatchObject body assertions present
  const hasBodyAssert = allContent.includes("toMatchObject") || allContent.includes("response.json()");
  checks.push(hasBodyAssert);
  if (!hasBodyAssert) {
    warnings.push("No response body assertions (toMatchObject / response.json()) found");
  }

  const score = checks.filter(Boolean).length / checks.length;
  const details = `${checks.filter(Boolean).length}/${checks.length} statistical checks passed. Files generated: ${files.length}`;

  return { score, details, warnings };
}

