/**
 * Agent 4 Evals — UI Automation Engineer
 *
 * Structural: validates generated files JSON schema
 * Statistical: checks POM structure, locator quality, security, test independence
 */

const REQUIRED_UI_FILES = [
  "pages/LoginPage.ts",
  "pages/PartsListPage.ts",
  "pages/PartDetailPage.ts",
  "pages/PartFormPage.ts",
  "helpers/fixtures.ts",
  "playwright.config.ts",
  "package.json",
  ".env.example",
];

const REQUIRED_PAGE_METHODS: Record<string, string[]> = {
  "LoginPage.ts": ["navigate", "fillCredentials", "submit"],
  "PartsListPage.ts": ["navigate", "clickCreatePart", "searchPart"],
  "PartDetailPage.ts": ["clickEdit", "clickDelete"],
  "PartFormPage.ts": ["fillName", "submit", "getValidationError"],
};

const FRAGILE_LOCATOR_PATTERNS = [
  /page\.locator\(['"]div\./g,
  /page\.locator\(['"]span\./g,
  /page\.locator\(['"]\.[\w-]+['"]\)/g,   // bare class selector
  /\$\(['"].+['"]\)/g,                     // jQuery-style (not Playwright but catches bad imports)
];

const PREFERRED_LOCATOR_PATTERNS = [
  "getByRole",
  "getByLabel",
  "getByTestId",
  "getByText",
  "getByPlaceholder",
];

const HARDCODED_SECRET_PATTERNS = [
  /password\s*=\s*['"][^'"]+['"]/gi,
  /username\s*=\s*['"][^'"]{3,}['"]/gi,
  /localhost:\d{4}/g,
  /127\.0\.0\.1/g,
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratedFile {
  path: string;
  content: string;
}

// ─── Structural Eval ─────────────────────────────────────────────────────────

export function runAgent4StructuralEval(output: unknown): { passed: boolean; issues: string[] } {
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

export function runAgent4StatisticalEval(output: unknown): {
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
  const allContent = files.map((f) => f.content).join("\n");

  // Check 1: All required files present
  const missingFiles = REQUIRED_UI_FILES.filter(
    (req) => !filePaths.some((p) => p.endsWith(req) || p === req)
  );
  const hasRequiredFiles = missingFiles.length === 0;
  checks.push(hasRequiredFiles);
  if (!hasRequiredFiles) {
    warnings.push(`Missing required files: ${missingFiles.join(", ")}`);
  }

  // Check 2: Each page class has required methods
  const methodViolations: string[] = [];
  for (const [pageFile, methods] of Object.entries(REQUIRED_PAGE_METHODS)) {
    const file = files.find((f) => f.path.endsWith(pageFile));
    if (file) {
      for (const method of methods) {
        if (!file.content.includes(method)) {
          methodViolations.push(`${pageFile} missing method: ${method}()`);
        }
      }
    }
  }
  checks.push(methodViolations.length === 0);
  if (methodViolations.length > 0) {
    methodViolations.forEach((v) => warnings.push(`POM structure: ${v}`));
  }

  // Check 3: Preferred locators used (getByRole, getByLabel, getByTestId)
  const preferredCount = PREFERRED_LOCATOR_PATTERNS.filter((p) => allContent.includes(p)).length;
  const usesPreferredLocators = preferredCount >= 3;
  checks.push(usesPreferredLocators);
  if (!usesPreferredLocators) {
    warnings.push(`Only ${preferredCount}/5 preferred locator types found — prefer getByRole, getByLabel, getByTestId`);
  }

  // Check 4: No fragile CSS locators used
  const fragileFound: string[] = [];
  for (const file of files) {
    for (const pattern of FRAGILE_LOCATOR_PATTERNS) {
      if (pattern.test(file.content)) {
        fragileFound.push(file.path);
      }
    }
  }
  checks.push(fragileFound.length === 0);
  if (fragileFound.length > 0) {
    warnings.push(`Fragile CSS locators found in: ${[...new Set(fragileFound)].join(", ")}`);
  }

  // Check 5: No hardcoded credentials
  const secretViolations: string[] = [];
  for (const file of files) {
    for (const pattern of HARDCODED_SECRET_PATTERNS) {
      const match = file.content.match(pattern);
      if (match) {
        secretViolations.push(`"${file.path}": found "${match[0].slice(0, 40)}"`);
      }
    }
  }
  checks.push(secretViolations.length === 0);
  if (secretViolations.length > 0) {
    warnings.push(`SECURITY: Hardcoded secrets in: ${secretViolations.join(", ")}`);
  }

  // Check 6: authenticatedPage fixture present in helpers
  const hasFixture = allContent.includes("authenticatedPage") && allContent.includes("extend");
  checks.push(hasFixture);
  if (!hasFixture) {
    warnings.push("No shared authenticatedPage fixture found — tests will duplicate login logic");
  }

  // Check 7: Page URL / title / visibility assertions present
  const hasUrlAssert = allContent.includes("toHaveURL");
  const hasTitleAssert = allContent.includes("toHaveTitle") || allContent.includes("toBeVisible");
  const hasAssertions = hasUrlAssert && hasTitleAssert;
  checks.push(hasAssertions);
  if (!hasUrlAssert) {
    warnings.push("No toHaveURL assertions found — verify navigation is asserted after actions");
  }
  if (!hasTitleAssert) {
    warnings.push("No toHaveTitle/toBeVisible assertions found — verify element visibility is asserted");
  }

  // Check 8: At least one .ui.spec.ts file generated
  const specFiles = files.filter((f) => f.path.includes(".ui.spec.ts"));
  checks.push(specFiles.length >= 1);
  if (specFiles.length === 0) {
    warnings.push("No .ui.spec.ts test files found in generated output");
  }

  const score = checks.filter(Boolean).length / checks.length;
  const details = `${checks.filter(Boolean).length}/${checks.length} statistical checks passed. Files generated: ${files.length}`;

  return { score, details, warnings };
}

