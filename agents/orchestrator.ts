/**
 * InvenTree QE Agentic Pipeline — Orchestrator (with Evals)
 *
 * Chains 5 specialised QE agents sequentially, with a 3-layer eval gate
 * after each agent:
 *
 *   Agent → [Structural Eval] → [Statistical Eval] → [LLM-as-Judge]
 *         ↘ FAIL → retry (up to 2x with self-correction prompt)
 *
 * Pipeline:
 *   1. Requirements Analyst        → requirements brief JSON
 *   2. Test Design Engineer        → test case catalogue JSON
 *   3. API Automation Engineer     → Playwright API spec files
 *   4. UI Automation Engineer      → Playwright UI spec files (POM)
 *   5. QA Lead Reviewer            → quality gate report JSON
 *
 * Usage:
 *   npm install
 *   cp .env.example .env   # fill in your keys
 *   npx ts-node orchestrator.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

import { evaluateAgent, buildRetryPrompt, buildPipelineSummary } from "./evals/eval-runner";
import { EvalReport, PipelineEvalSummary, DEFAULT_RETRY_CONFIG } from "./evals/eval-types";

dotenv.config();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL = "gemini-3.8-flash";
const MAX_RETRIES = DEFAULT_RETRY_CONFIG.maxRetries; // 2

const OUTPUT_DIR = path.resolve(__dirname, "../agent-artifacts/logs");
const EVALS_DIR = path.resolve(OUTPUT_DIR, "evals");
const AUTOMATION_API_DIR = path.resolve(__dirname, "../automation/api");
const AUTOMATION_UI_DIR = path.resolve(__dirname, "../automation/ui");
const PIPELINE_RUN_ID = uuidv4();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------------------------------------------------------------------
// System Instructions
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
  "requirements-analyst": `
ROLE: Senior Quality Engineer — Requirements Analyst
You produce structured requirements briefs for InvenTree Part CRUD workflows.
Output ONLY a JSON object. No markdown fences. No explanations.
Schema: { application, version_assumptions, functional_areas: [{id, area, description, business_rules, api_endpoints, ui_flows}], non_functional_areas: [{id, area, description}], out_of_scope }
RULES: Cover all CRUD for Parts and Categories. ≥2 business rules per area. List all REST endpoints. No test cases.
`,

  "test-design-engineer": `
ROLE: Senior Quality Engineer — Test Design Engineer
You produce comprehensive manual test case catalogues from requirements briefs.
Output ONLY a JSON object. No markdown fences. No explanations.
Schema: { test_suite: { name, total_cases, test_cases: [{id, type, functional_area_ref, title, priority, preconditions, steps, test_data, tags}] } }
RULES: ≥8 API cases per CRUD op. ≥6 UI cases per CRUD op. Happy/boundary/negative/auth scenarios. Include test_data. No automation code.
`,

  "api-automation-engineer": `
ROLE: Senior SDET — API Automation Engineer
You produce Playwright + TypeScript API automation scripts from test catalogues.
Output ONLY a JSON object: { "files": [{"path": string, "content": string}] }. No markdown fences.
RULES: Use @playwright/test APIRequestContext. Shared ApiClient in helpers/api-client.ts. All config from process.env. afterEach cleanup. Assert status AND body. JSDoc on all helpers.
`,

  "ui-automation-engineer": `
ROLE: Senior SDET — UI Automation Engineer
You produce Playwright + TypeScript UI automation scripts using Page Object Model.
Output ONLY a JSON object: { "files": [{"path": string, "content": string}] }. No markdown fences.
RULES: Page classes: LoginPage, PartsListPage, PartDetailPage, PartFormPage. Prefer getByRole/getByLabel/getByTestId. authenticatedPage fixture. Tests independent via API setup/teardown. All config from process.env.
`,

  "qa-lead-reviewer": `
ROLE: QA Lead — Code and Coverage Reviewer
You review automation artefacts and produce a quality gate report.
Output ONLY a JSON object. No markdown fences.
Schema: { overall_status, checklist: [{item, status, notes, file_refs}], summary, recommendations }
RULES: Check P0 coverage, no hardcoded creds, cleanup hooks, POM, status+body asserts, independence, 4xx coverage, TypeScript types.
`,
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PROMPT_1_REQUIREMENTS = `
Analyse the InvenTree inventory management application and produce a structured
requirements brief for the Part CRUD workflows.

Functional areas to cover:
1. Part Category — Create, Read (list + detail), Update, Delete
2. Part — Create, Read (list + detail), Update (PUT + PATCH), Delete
3. Part Search & Filtering — filter by category, active status, keyword
4. Authentication — Token-based auth required for all write operations

Key API endpoints:
  GET/POST  /api/part/                    List / Create parts
  GET/PUT/PATCH/DELETE /api/part/{id}/    Part detail CRUD
  GET/POST  /api/part/category/           List / Create categories
  GET/PUT/DELETE /api/part/category/{id}/ Category detail CRUD

UI pages: /part/ (list), /part/{id}/ (detail), Create/Edit form, Category tree.

Produce the output JSON now.
`;

function buildPrompt2(requirementsBrief: string): string {
  return `
Below is the requirements brief produced by the Requirements Analyst agent.
Generate a comprehensive manual test case catalogue for all functional areas.

Requirements Brief:
${requirementsBrief}

Requirements:
- ≥8 API test cases per CRUD operation (happy path, boundaries, negative)
- ≥6 UI test cases per CRUD operation (happy path, boundaries, negative)
- Auth failure tests for every write endpoint
- Part Category as prerequisite for Part creation tests
- Test data in every test case
- Tags: smoke, regression, negative, auth, boundary

Produce the full test case catalogue JSON now.
`;
}

function buildPrompt3(testCatalogue: string): string {
  return `
Below is the test case catalogue. Generate Playwright + TypeScript API automation
scripts for all API test cases (type: "API") in the catalogue.

Test Case Catalogue:
${testCatalogue}

Technical requirements:
- process.env.INVENTREE_BASE_URL and process.env.INVENTREE_API_TOKEN for config
- Test timeout: 30000ms
- Generate: helpers/api-client.ts, tests/*.api.spec.ts, playwright.config.ts, package.json, .env.example

Generate all file contents as the specified JSON structure now.
`;
}

function buildPrompt4(testCatalogue: string): string {
  return `
Below is the test case catalogue. Generate Playwright + TypeScript UI automation
scripts using POM for all UI test cases (type: "UI") in the catalogue.

Test Case Catalogue:
${testCatalogue}

Technical requirements:
- process.env.INVENTREE_BASE_URL, INVENTREE_USERNAME, INVENTREE_PASSWORD
- Chromium, 1280x720 viewport, screenshot on failure
- Generate: pages/*.ts, helpers/fixtures.ts, tests/*.ui.spec.ts, playwright.config.ts, package.json, .env.example

Generate all file contents as the specified JSON structure now.
`;
}

function buildPrompt5(apiFiles: string[], uiFiles: string[]): string {
  return `
Review the automation scripts generated by AI agents and produce a quality gate report.

API automation files: ${apiFiles.join(", ")}
UI automation files: ${uiFiles.join(", ")}

Checklist (evaluate all 8):
1. All P0 test cases covered in automation
2. No hardcoded credentials or base URLs
3. Proper cleanup (afterEach/afterAll) prevents test pollution
4. Page Object Model correctly separates concerns
5. API tests assert both status code AND response body
6. Tests are independent and can run in any order
7. Error scenarios tested (4xx responses)
8. TypeScript types explicit (no unexplained 'any')

Produce the JSON quality report now.
`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function log(tag: string, message: string): void {
  console.log(`[${new Date().toISOString()}] [${tag}] ${message}`);
}

function saveArtifact(filename: string, content: string): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), content, "utf-8");
  console.log(`  💾 Artifact: ${filename}`);
}

function saveEvalReport(agentId: string, report: EvalReport): void {
  fs.mkdirSync(EVALS_DIR, { recursive: true });
  const filename = `eval-${agentId}.json`;
  fs.writeFileSync(path.join(EVALS_DIR, filename), JSON.stringify(report, null, 2), "utf-8");
  console.log(`  📋 Eval saved: evals/${filename}`);
}

function writeGeneratedFile(baseDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
  console.log(`  ✓ Generated: ${relativePath}`);
}

function parseJsonOutput(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\n?/gm, "").replace(/^```\n?/gm, "");
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Agent Runner (with Eval + Retry)
// ---------------------------------------------------------------------------

/**
 * Run an agent with the three-layer eval gate.
 * On FAIL: retry up to MAX_RETRIES times with a self-correction prompt.
 * On WARN: continue with a console warning.
 * On PASS: continue normally.
 */
async function runAgentWithEvals(
  agentId: string,
  userPrompt: string,
  evalContext?: string        // ground truth passed to the LLM judge
): Promise<{ output: string; evalReport: EvalReport }> {
  let currentPrompt = userPrompt;
  let lastReport: EvalReport | null = null;
  let lastOutput = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      log(agentId, `🔄 Retry attempt ${attempt}/${MAX_RETRIES}`);
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_CONFIG.backoffMs * attempt));
    }

    // Call the agent
    log(agentId, `Calling model (attempt ${attempt})...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interaction = await (client as any).interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTIONS[agentId],
      input: currentPrompt,
      response_format: { type: "object", description: "Structured JSON output" },
      generation_config: {
        temperature: 0.15,
        max_output_tokens: 32768,
      },
    });

    lastOutput = (interaction as any).output_text ?? "";
    log(agentId, `Output length: ${lastOutput.length} chars`);

    // Run eval
    const report = await evaluateAgent(agentId, lastOutput, attempt, evalContext);
    report.retryAttempt = attempt;
    lastReport = report;
    saveEvalReport(agentId, report);

    if (report.overallVerdict === "PASS" || report.overallVerdict === "WARN") {
      if (report.overallVerdict === "WARN") {
        log(agentId, `⚠️  WARN — proceeding with warnings`);
      } else {
        log(agentId, `✅ PASS`);
      }
      break;
    }

    // FAIL — build retry prompt
    if (attempt < MAX_RETRIES) {
      log(agentId, `❌ FAIL — building self-correction retry prompt`);
      currentPrompt = buildRetryPrompt(userPrompt, report);
    } else {
      log(agentId, `❌ FAIL after ${MAX_RETRIES} retries — proceeding with best available output`);
    }
  }

  return { output: lastOutput, evalReport: lastReport! };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function runPipeline(): Promise<void> {
  const startedAt = new Date().toISOString();
  const allEvalReports: EvalReport[] = [];
  let halted = false;
  let haltReason: string | undefined;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   InvenTree QE Agentic Pipeline + Evals — Starting   ║");
  console.log(`║   Run ID: ${PIPELINE_RUN_ID.slice(0, 36)}  ║`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  try {
    // ── Step 1: Requirements Analyst ────────────────────────────────────────
    console.log("\n▶  Step 1 / 5 — Requirements Analyst");
    const { output: requirementsRaw, evalReport: eval1 } = await runAgentWithEvals(
      "requirements-analyst",
      PROMPT_1_REQUIREMENTS
    );
    saveArtifact("01-requirements-brief.json", requirementsRaw);
    allEvalReports.push(eval1);

    // Halt if structural FAIL that blocks downstream
    if (eval1.overallVerdict === "FAIL" && eval1.blockingIssues.length > 0) {
      halted = true;
      haltReason = `Requirements Analyst FAIL: ${eval1.blockingIssues[0]}`;
      throw new Error(haltReason);
    }

    // ── Step 2: Test Design Engineer ────────────────────────────────────────
    console.log("\n▶  Step 2 / 5 — Test Design Engineer");
    const { output: testCatalogueRaw, evalReport: eval2 } = await runAgentWithEvals(
      "test-design-engineer",
      buildPrompt2(requirementsRaw),
      requirementsRaw          // pass brief as ground truth for traceability judge
    );
    saveArtifact("02-test-catalogue.json", testCatalogueRaw);
    allEvalReports.push(eval2);

    if (eval2.overallVerdict === "FAIL" && eval2.blockingIssues.length > 0) {
      halted = true;
      haltReason = `Test Design Engineer FAIL: ${eval2.blockingIssues[0]}`;
      throw new Error(haltReason);
    }

    // Extract P0 IDs for downstream eval judges
    const testCatalogueObj = parseJsonOutput(testCatalogueRaw) as { test_suite: { test_cases: Array<{ id: string; type: string; priority: string }> } };
    const p0ApiIds = testCatalogueObj.test_suite.test_cases
      .filter((tc) => tc.type === "API" && tc.priority === "P0")
      .map((tc) => tc.id)
      .join(", ");
    const p0UiIds = testCatalogueObj.test_suite.test_cases
      .filter((tc) => tc.type === "UI" && tc.priority === "P0")
      .map((tc) => tc.id)
      .join(", ");

    // ── Step 3: API Automation Engineer ─────────────────────────────────────
    console.log("\n▶  Step 3 / 5 — API Automation Engineer");
    const { output: apiFilesRaw, evalReport: eval3 } = await runAgentWithEvals(
      "api-automation-engineer",
      buildPrompt3(testCatalogueRaw),
      `P0 API test IDs that MUST be covered: ${p0ApiIds}`
    );
    saveArtifact("03-api-automation-output.json", apiFilesRaw);
    allEvalReports.push(eval3);

    const apiOutput = parseJsonOutput(apiFilesRaw) as { files: Array<{ path: string; content: string }> };
    const apiFilePaths: string[] = [];
    for (const file of apiOutput.files ?? []) {
      writeGeneratedFile(AUTOMATION_API_DIR, file.path, file.content);
      apiFilePaths.push(file.path);
    }

    // ── Step 4: UI Automation Engineer ──────────────────────────────────────
    console.log("\n▶  Step 4 / 5 — UI Automation Engineer");
    const { output: uiFilesRaw, evalReport: eval4 } = await runAgentWithEvals(
      "ui-automation-engineer",
      buildPrompt4(testCatalogueRaw),
      `P0 UI test IDs that MUST be covered: ${p0UiIds}`
    );
    saveArtifact("04-ui-automation-output.json", uiFilesRaw);
    allEvalReports.push(eval4);

    const uiOutput = parseJsonOutput(uiFilesRaw) as { files: Array<{ path: string; content: string }> };
    const uiFilePaths: string[] = [];
    for (const file of uiOutput.files ?? []) {
      writeGeneratedFile(AUTOMATION_UI_DIR, file.path, file.content);
      uiFilePaths.push(file.path);
    }

    // ── Step 5: QA Lead Reviewer ─────────────────────────────────────────────
    console.log("\n▶  Step 5 / 5 — QA Lead Reviewer");
    const { output: qualityReportRaw } = await runAgentWithEvals(
      "qa-lead-reviewer",
      buildPrompt5(apiFilePaths, uiFilePaths)
    );
    saveArtifact("05-quality-report.json", qualityReportRaw);

  } catch (err) {
    if (!halted) {
      haltReason = String(err);
      halted = true;
    }
    console.error(`\n✘ Pipeline ${halted ? "halted" : "failed"}: ${haltReason}`);
  }

  // ── Pipeline Summary ───────────────────────────────────────────────────────
  const summary: PipelineEvalSummary = buildPipelineSummary(
    PIPELINE_RUN_ID,
    startedAt,
    allEvalReports,
    halted,
    haltReason
  );
  saveArtifact("00-pipeline-eval-summary.json", JSON.stringify(summary, null, 2));

  // Print summary table
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│                 PIPELINE EVAL SUMMARY                    │");
  console.log("├──────────────────────────────┬──────────┬────────────────┤");
  console.log("│ Agent                         │ Verdict  │ Score          │");
  console.log("├──────────────────────────────┼──────────┼────────────────┤");
  for (const r of allEvalReports) {
    const verdict = r.overallVerdict.padEnd(8);
    const score = r.aggregateScore.toFixed(2).padEnd(14);
    const name = r.agentId.padEnd(29);
    const retries = r.retryAttempt > 0 ? ` (${r.retryAttempt} retries)` : "";
    console.log(`│ ${name}│ ${verdict} │ ${score}${retries}`);
  }
  console.log("├──────────────────────────────┴──────────┴────────────────┤");
  console.log(`│ OVERALL: ${summary.overallPipelineStatus.padEnd(8)} | Retries: ${summary.totalRetries} | Halted: ${summary.halted}    │`);
  console.log("└─────────────────────────────────────────────────────────┘\n");
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

runPipeline().catch((err) => {
  console.error("\n✘ Fatal error:", err);
  process.exit(1);
});

