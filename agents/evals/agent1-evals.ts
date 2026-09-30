/**
 * Agent 1 Evals — Requirements Analyst
 *
 * Structural: validates the JSON schema shape
 * Statistical: checks coverage counts and rule depth
 */

// ─── Structural Eval ─────────────────────────────────────────────────────────

export function runAgent1StructuralEval(output: unknown): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (typeof output !== "object" || output === null) {
    return { passed: false, issues: ["Output is not a JSON object"] };
  }

  const o = output as Record<string, unknown>;

  // Required top-level keys
  const requiredKeys = ["application", "version_assumptions", "functional_areas", "non_functional_areas", "out_of_scope"];
  for (const key of requiredKeys) {
    if (!(key in o)) issues.push(`Missing required field: "${key}"`);
  }

  // functional_areas must be an array
  if (!Array.isArray(o.functional_areas)) {
    issues.push('"functional_areas" must be an array');
  } else {
    o.functional_areas.forEach((fa: unknown, i: number) => {
      const area = fa as Record<string, unknown>;
      const faRequired = ["id", "area", "description", "business_rules", "api_endpoints", "ui_flows"];
      for (const key of faRequired) {
        if (!(key in area)) {
          issues.push(`functional_areas[${i}] missing field: "${key}"`);
        }
      }
      if (!Array.isArray(area.business_rules)) {
        issues.push(`functional_areas[${i}].business_rules must be an array`);
      }
      if (!Array.isArray(area.api_endpoints)) {
        issues.push(`functional_areas[${i}].api_endpoints must be an array`);
      }
      if (!Array.isArray(area.ui_flows)) {
        issues.push(`functional_areas[${i}].ui_flows must be an array`);
      }
    });
  }

  // non_functional_areas must be an array
  if (!Array.isArray(o.non_functional_areas)) {
    issues.push('"non_functional_areas" must be an array');
  }

  // out_of_scope must be an array
  if (!Array.isArray(o.out_of_scope)) {
    issues.push('"out_of_scope" must be an array');
  }

  return { passed: issues.length === 0, issues };
}

// ─── Statistical Eval ────────────────────────────────────────────────────────

export function runAgent1StatisticalEval(output: unknown): {
  score: number;
  details: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const checks: boolean[] = [];

  const o = output as Record<string, unknown>;
  const functionalAreas = Array.isArray(o.functional_areas) ? o.functional_areas : [];

  // Check 1: At least 4 functional areas
  const faCount = functionalAreas.length;
  const hasSufficientAreas = faCount >= 4;
  checks.push(hasSufficientAreas);
  if (!hasSufficientAreas) {
    warnings.push(`Only ${faCount} functional areas defined — expected ≥4 (Category CRUD, Part CRUD, Search, Auth)`);
  }

  // Check 2: Each FA has ≥2 business rules
  const allHaveRules = (functionalAreas as Record<string, unknown>[]).every((fa) => {
    const rules = Array.isArray(fa.business_rules) ? fa.business_rules : [];
    return rules.length >= 2;
  });
  checks.push(allHaveRules);
  if (!allHaveRules) {
    warnings.push("One or more functional areas have fewer than 2 business rules");
  }

  // Check 3: Each FA has ≥1 API endpoint
  const allHaveEndpoints = (functionalAreas as Record<string, unknown>[]).every((fa) => {
    const eps = Array.isArray(fa.api_endpoints) ? fa.api_endpoints : [];
    return eps.length >= 1;
  });
  checks.push(allHaveEndpoints);
  if (!allHaveEndpoints) {
    warnings.push("One or more functional areas have no API endpoints listed");
  }

  // Check 4: Each FA has ≥3 UI flow steps
  const allHaveUIFlows = (functionalAreas as Record<string, unknown>[]).every((fa) => {
    const flows = Array.isArray(fa.ui_flows) ? fa.ui_flows : [];
    return flows.length >= 3;
  });
  checks.push(allHaveUIFlows);
  if (!allHaveUIFlows) {
    warnings.push("One or more functional areas have fewer than 3 UI flow steps");
  }

  // Check 5: CRUD operations covered (Create, Read, Update, Delete keywords in area names)
  const areaNames = (functionalAreas as Record<string, unknown>[])
    .map((fa) => String(fa.area ?? "").toLowerCase());
  const cruds = ["create", "read", "update", "delete"];
  const coveredCruds = cruds.filter((op) => areaNames.some((name) => name.includes(op)));
  const crudCoverage = coveredCruds.length / cruds.length;
  checks.push(crudCoverage === 1);
  if (crudCoverage < 1) {
    const missing = cruds.filter((op) => !areaNames.some((name) => name.includes(op)));
    warnings.push(`CRUD coverage incomplete — missing: ${missing.join(", ")}`);
  }

  const score = checks.filter(Boolean).length / checks.length;
  const details = `${checks.filter(Boolean).length}/${checks.length} statistical checks passed`;

  return { score, details, warnings };
}

