/**
 * Agent 2 Evals — Test Design Engineer
 *
 * Structural: validates test catalogue JSON schema
 * Statistical: checks counts, scenario diversity, traceability, priority coverage
 */

const MIN_API_CASES_PER_OPERATION = 8;
const MIN_UI_CASES_PER_OPERATION = 6;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  type: "API" | "UI";
  functional_area_ref: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  preconditions: string[];
  steps: { step_number: number; action: string; expected_result: string }[];
  test_data: object;
  tags: string[];
}

// ─── Structural Eval ─────────────────────────────────────────────────────────

export function runAgent2StructuralEval(output: unknown): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (typeof output !== "object" || output === null) {
    return { passed: false, issues: ["Output is not a JSON object"] };
  }

  const o = output as Record<string, unknown>;

  if (!("test_suite" in o)) {
    return { passed: false, issues: ['Missing required top-level field: "test_suite"'] };
  }

  const suite = o.test_suite as Record<string, unknown>;

  if (typeof suite.name !== "string") issues.push('"test_suite.name" must be a string');
  if (typeof suite.total_cases !== "number") issues.push('"test_suite.total_cases" must be a number');

  if (!Array.isArray(suite.test_cases)) {
    issues.push('"test_suite.test_cases" must be an array');
    return { passed: false, issues };
  }

  suite.test_cases.forEach((tc: unknown, i: number) => {
    const t = tc as Record<string, unknown>;
    const required = ["id", "type", "functional_area_ref", "title", "priority", "preconditions", "steps", "test_data", "tags"];
    for (const key of required) {
      if (!(key in t)) issues.push(`test_cases[${i}] missing field: "${key}"`);
    }

    if (t.type !== "API" && t.type !== "UI") {
      issues.push(`test_cases[${i}].type must be "API" or "UI", got: "${t.type}"`);
    }

    if (!["P0", "P1", "P2"].includes(t.priority as string)) {
      issues.push(`test_cases[${i}].priority must be P0, P1, or P2, got: "${t.priority}"`);
    }

    if (!Array.isArray(t.steps) || (t.steps as unknown[]).length === 0) {
      issues.push(`test_cases[${i}] must have at least 1 step`);
    }

    if (!Array.isArray(t.tags)) {
      issues.push(`test_cases[${i}].tags must be an array`);
    }
  });

  return { passed: issues.length === 0, issues };
}

// ─── Statistical Eval ────────────────────────────────────────────────────────

export function runAgent2StatisticalEval(output: unknown): {
  score: number;
  details: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const checks: boolean[] = [];

  const suite = (output as Record<string, unknown>).test_suite as Record<string, unknown>;
  const testCases: TestCase[] = Array.isArray(suite?.test_cases) ? suite.test_cases as TestCase[] : [];

  const apiCases = testCases.filter((tc) => tc.type === "API");
  const uiCases = testCases.filter((tc) => tc.type === "UI");

  // Check 1: Total API cases ≥ minimum
  const expectedApiOps = ["create", "read", "update", "delete"]; // 4 operations × 8 = 32 min
  const totalMinAPI = expectedApiOps.length * MIN_API_CASES_PER_OPERATION;
  const apiCountOk = apiCases.length >= totalMinAPI;
  checks.push(apiCountOk);
  if (!apiCountOk) {
    warnings.push(`Only ${apiCases.length} API test cases — expected ≥${totalMinAPI} (${MIN_API_CASES_PER_OPERATION} per CRUD operation)`);
  }

  // Check 2: Total UI cases ≥ minimum
  const totalMinUI = expectedApiOps.length * MIN_UI_CASES_PER_OPERATION;
  const uiCountOk = uiCases.length >= totalMinUI;
  checks.push(uiCountOk);
  if (!uiCountOk) {
    warnings.push(`Only ${uiCases.length} UI test cases — expected ≥${totalMinUI} (${MIN_UI_CASES_PER_OPERATION} per CRUD operation)`);
  }

  // Check 3: P0 cases exist for both API and UI
  const p0Api = apiCases.filter((tc) => tc.priority === "P0");
  const p0Ui = uiCases.filter((tc) => tc.priority === "P0");
  const hasP0 = p0Api.length >= 4 && p0Ui.length >= 4;
  checks.push(hasP0);
  if (!hasP0) {
    warnings.push(`Insufficient P0 cases — API: ${p0Api.length}, UI: ${p0Ui.length} (expect ≥4 each)`);
  }

  // Check 4: Negative/error scenarios present (tags or title keywords)
  const hasNegative = testCases.some(
    (tc) => tc.tags.includes("negative") || tc.title.toLowerCase().includes("invalid") || tc.title.toLowerCase().includes("missing")
  );
  checks.push(hasNegative);
  if (!hasNegative) {
    warnings.push("No negative/error test cases found — check for 'negative' tag or 'invalid/missing' in titles");
  }

  // Check 5: Auth failure tests present
  const hasAuth = testCases.some(
    (tc) => tc.tags.includes("auth") && tc.title.toLowerCase().includes("unauthorized")
  );
  checks.push(hasAuth);
  if (!hasAuth) {
    warnings.push("No explicit authentication failure tests found — expect tests for 401 Unauthorized");
  }

  // Check 6: Every test case has non-empty test_data
  const allHaveData = testCases.every((tc) => tc.test_data && Object.keys(tc.test_data).length > 0);
  checks.push(allHaveData);
  if (!allHaveData) {
    const noData = testCases.filter((tc) => !tc.test_data || Object.keys(tc.test_data).length === 0);
    warnings.push(`${noData.length} test cases have empty test_data: ${noData.map((tc) => tc.id).join(", ")}`);
  }

  // Check 7: total_cases matches actual array length
  const totalMatchesCount = suite.total_cases === testCases.length;
  checks.push(totalMatchesCount);
  if (!totalMatchesCount) {
    warnings.push(`test_suite.total_cases (${suite.total_cases}) does not match actual array length (${testCases.length})`);
  }

  const score = checks.filter(Boolean).length / checks.length;
  const details = `${checks.filter(Boolean).length}/${checks.length} statistical checks passed. API: ${apiCases.length} cases, UI: ${uiCases.length} cases`;

  return { score, details, warnings };
}

