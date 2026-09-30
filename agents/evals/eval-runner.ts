/**
 * Eval Runner
 *
 * Orchestrates all three eval layers for a given agent:
 *   1. Structural Eval  — JSON schema / shape validation (fast, deterministic)
 *   2. Statistical Eval — Count and coverage checks (fast, deterministic)
 *   3. LLM-as-Judge     — Semantic quality scoring (calls Gemini)
 *
 * On FAIL verdict → retries the agent up to maxRetries times, injecting
 * the eval report as additional context so the agent can self-correct.
 */

import { GoogleGenAI } from "@google/genai";
import {
  EvalReport,
  EvalStatus,
  EvalType,
  PipelineEvalSummary,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  EVAL_THRESHOLDS,
} from "./eval-types";
import { runAgent1StructuralEval, runAgent1StatisticalEval } from "./agent1-evals";
import { runAgent2StructuralEval, runAgent2StatisticalEval } from "./agent2-evals";
import { runAgent3StructuralEval, runAgent3StatisticalEval } from "./agent3-evals";
import { runAgent4StructuralEval, runAgent4StatisticalEval } from "./agent4-evals";

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.8-flash";

// ─── LLM-as-Judge System Instruction ─────────────────────────────────────────

const EVAL_JUDGE_SYSTEM_INSTRUCTION = `
ROLE: Independent AI Evaluator — QE Pipeline Judge

You are an expert QA architect and SDET evaluating outputs produced by other
AI agents in a quality engineering pipeline for InvenTree (an inventory
management system). Your job is to assess whether each output is fit to
be passed to the next stage of the pipeline.

YOUR OUTPUT must always be a JSON object matching this schema:
{
  "agent_id": string,
  "eval_timestamp": string,
  "overall_verdict": "PASS" | "WARN" | "FAIL",
  "retry_recommended": boolean,
  "dimensions": [
    {
      "dimension": string,
      "score": number,
      "status": "PASS" | "WARN" | "FAIL",
      "rationale": string,
      "issues": string[]
    }
  ],
  "aggregate_score": number,
  "blocking_issues": string[],
  "warnings": string[],
  "improvement_suggestions": string[]
}

VERDICT RULES:
- PASS: aggregate_score >= 0.85 AND no blocking_issues
- WARN: aggregate_score >= 0.65 AND no blocking_issues
- FAIL: aggregate_score < 0.65 OR any blocking_issue present

BLOCKING ISSUES (automatic FAIL):
- Required JSON schema fields are missing or wrong type
- Agent violated an explicit "DO NOT" rule
- Hardcoded credentials found in generated code
- P0 test cases missing from automation coverage

RULES:
1. Be critical but fair — score based on evidence in the output, not assumptions.
2. Never inflate scores.
3. Cite specific field names, values, or patterns for every score.
4. Respond ONLY with the JSON object, no markdown fences.
`;

// ─── LLM Judge Prompts per Agent ─────────────────────────────────────────────

function buildJudgePrompt(agentId: string, agentOutput: string, context?: string): string {
  const prompts: Record<string, string> = {
    "requirements-analyst": `
Evaluate this output from the Requirements Analyst agent.
Agent Task: Analyse InvenTree Part CRUD requirements and produce a structured brief.

Agent Output:
${agentOutput}

Evaluate these dimensions (score 0.0–1.0 each):
1. Schema Compliance (weight 0.25): Does the JSON match the required schema exactly?
2. Coverage Completeness (weight 0.30): Are all 4 functional domains covered (Category CRUD, Part CRUD, Search, Auth)?
3. Business Rule Quality (weight 0.25): Are rules specific, testable, not vague platitudes?
4. Endpoint Accuracy (weight 0.10): Do listed endpoints match real InvenTree API paths?
5. UI Flow Clarity (weight 0.10): Are UI steps numbered and unambiguous?

Produce the evaluation JSON now.`,

    "test-design-engineer": `
Evaluate this output from the Test Design Engineer agent.
Agent Task: Generate manual test cases for InvenTree Part CRUD workflows.

Requirements Brief (ground truth for traceability):
${context ?? "Not provided"}

Agent Output:
${agentOutput}

Evaluate these dimensions (score 0.0–1.0 each):
1. Schema Compliance (weight 0.15): Does the JSON match the test catalogue schema?
2. Count Adequacy (weight 0.25): Are there ≥8 API and ≥6 UI cases per CRUD operation?
3. Scenario Diversity (weight 0.25): Are happy path, boundary, negative, auth scenarios all present per area?
4. Traceability (weight 0.15): Does every TC reference a valid FA-xxx from the brief?
5. Test Data Quality (weight 0.10): Is test data realistic and boundary-aware?
6. Priority Distribution (weight 0.10): Do P0 cases exist for every functional area?

Produce the evaluation JSON now.`,

    "api-automation-engineer": `
Evaluate this output from the API Automation Engineer agent.
Agent Task: Generate Playwright + TypeScript API test scripts for InvenTree.

P0 API test IDs that MUST be covered (ground truth):
${context ?? "Not provided"}

Agent Output (generated files as JSON):
${agentOutput}

Evaluate these dimensions (score 0.0–1.0 each):
1. Schema Compliance (weight 0.10): Is the files array structure valid?
2. Required Files (weight 0.20): Are all mandatory files present (api-client.ts, playwright.config.ts, package.json, .env.example)?
3. Code Correctness (weight 0.25): Is TypeScript syntactically valid with logical imports?
4. Security (weight 0.20): Are all credentials and URLs read from process.env with no hardcoding?
5. Test Coverage (weight 0.15): Do all P0 API cases have corresponding test blocks?
6. Best Practices (weight 0.10): Are afterEach cleanup, test.step(), and JSDoc present?

Produce the evaluation JSON now.`,

    "ui-automation-engineer": `
Evaluate this output from the UI Automation Engineer agent.
Agent Task: Generate Playwright + TypeScript UI test scripts using POM for InvenTree.

P0 UI test IDs that MUST be covered (ground truth):
${context ?? "Not provided"}

Agent Output (generated files as JSON):
${agentOutput}

Evaluate these dimensions (score 0.0–1.0 each):
1. Schema Compliance (weight 0.10): Is the files array structure valid?
2. POM Structure (weight 0.25): Do all 4 page classes exist with correct method contracts?
3. Locator Quality (weight 0.20): Are getByRole/getByLabel/getByTestId used over fragile CSS selectors?
4. Security (weight 0.15): Are all credentials and URLs from process.env?
5. Test Independence (weight 0.15): Does each test set up and tear down its own data via API?
6. Assertion Quality (weight 0.15): Are URL, title, and visibility assertions used correctly?

Produce the evaluation JSON now.`,
  };

  return prompts[agentId] ?? `Evaluate the output of agent "${agentId}":\n${agentOutput}`;
}

// ─── Score → Status ───────────────────────────────────────────────────────────

function scoreToStatus(score: number): EvalStatus {
  if (score >= EVAL_THRESHOLDS.PASS_MIN_SCORE) return "PASS";
  if (score >= EVAL_THRESHOLDS.WARN_MIN_SCORE) return "WARN";
  return "FAIL";
}

// ─── Merge Structural + Statistical + LLM into one EvalReport ────────────────

function mergeEvalResults(
  agentId: string,
  structuralResult: { passed: boolean; issues: string[] },
  statisticalResult: { score: number; details: string; warnings: string[] },
  llmResult: EvalReport,
  retryAttempt: number
): EvalReport {
  const blockingIssues: string[] = [
    ...(!structuralResult.passed ? structuralResult.issues : []),
    ...llmResult.blockingIssues,
  ];

  const allWarnings: string[] = [
    ...statisticalResult.warnings,
    ...llmResult.warnings,
  ];

  // Structural failure overrides LLM score
  const finalScore = structuralResult.passed
    ? (statisticalResult.score * 0.3 + llmResult.aggregateScore * 0.7)
    : 0;

  const finalVerdict: EvalStatus =
    blockingIssues.length > 0
      ? "FAIL"
      : scoreToStatus(finalScore);

  return {
    agentId,
    evalTimestamp: new Date().toISOString(),
    evalType: ["structural", "statistical", "llm-judge"],
    overallVerdict: finalVerdict,
    retryRecommended: finalVerdict === "FAIL",
    retryAttempt,
    dimensions: llmResult.dimensions,
    aggregateScore: Math.round(finalScore * 100) / 100,
    blockingIssues,
    warnings: allWarnings,
    improvementSuggestions: llmResult.improvementSuggestions,
  };
}

// ─── Run LLM Judge ────────────────────────────────────────────────────────────

async function runLLMJudge(
  agentId: string,
  agentOutput: string,
  context?: string
): Promise<EvalReport> {
  const prompt = buildJudgePrompt(agentId, agentOutput, context);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interaction = await (client as any).interactions.create({
    model: MODEL,
    system_instruction: EVAL_JUDGE_SYSTEM_INSTRUCTION,
    input: prompt,
    response_format: { type: "object", description: "Eval report JSON" },
    generation_config: {
      temperature: 0.1,
      max_output_tokens: 8192,
    },
  });

  const raw = (interaction as any).output_text ?? "{}";
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/gm, "").replace(/^```\n?/gm, ""));

  return {
    agentId,
    evalTimestamp: parsed.eval_timestamp ?? new Date().toISOString(),
    evalType: ["llm-judge"],
    overallVerdict: parsed.overall_verdict ?? "FAIL",
    retryRecommended: parsed.retry_recommended ?? true,
    retryAttempt: 0,
    dimensions: parsed.dimensions ?? [],
    aggregateScore: parsed.aggregate_score ?? 0,
    blockingIssues: parsed.blocking_issues ?? [],
    warnings: parsed.warnings ?? [],
    improvementSuggestions: parsed.improvement_suggestions ?? [],
  };
}

// ─── Structural + Statistical Dispatch ───────────────────────────────────────

function runStructuralEval(agentId: string, output: unknown): { passed: boolean; issues: string[] } {
  switch (agentId) {
    case "requirements-analyst": return runAgent1StructuralEval(output);
    case "test-design-engineer": return runAgent2StructuralEval(output);
    case "api-automation-engineer": return runAgent3StructuralEval(output);
    case "ui-automation-engineer": return runAgent4StructuralEval(output);
    default: return { passed: true, issues: [] };
  }
}

function runStatisticalEval(agentId: string, output: unknown): { score: number; details: string; warnings: string[] } {
  switch (agentId) {
    case "requirements-analyst": return runAgent1StatisticalEval(output);
    case "test-design-engineer": return runAgent2StatisticalEval(output);
    case "api-automation-engineer": return runAgent3StatisticalEval(output);
    case "ui-automation-engineer": return runAgent4StatisticalEval(output);
    default: return { score: 1, details: "No statistical checks defined", warnings: [] };
  }
}

// ─── Main Public API ──────────────────────────────────────────────────────────

/**
 * Evaluate a single agent's output through all three eval layers.
 * Returns the merged EvalReport.
 */
export async function evaluateAgent(
  agentId: string,
  agentOutputRaw: string,
  retryAttempt: number = 0,
  context?: string  // e.g. requirements brief passed to Agent 2 judge
): Promise<EvalReport> {
  console.log(`\n  🔍 [EVAL] Running evals for: ${agentId} (attempt ${retryAttempt})`);

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(agentOutputRaw);
  } catch {
    return {
      agentId,
      evalTimestamp: new Date().toISOString(),
      evalType: ["structural"],
      overallVerdict: "FAIL",
      retryRecommended: true,
      retryAttempt,
      dimensions: [],
      aggregateScore: 0,
      blockingIssues: ["Output is not valid JSON — cannot parse agent response"],
      warnings: [],
      improvementSuggestions: ["Agent must respond with valid JSON only"],
    };
  }

  // Layer 1: Structural (synchronous)
  const structural = runStructuralEval(agentId, parsedOutput);
  console.log(`     Structural: ${structural.passed ? "✅ PASS" : "❌ FAIL"}`);

  // Layer 2: Statistical (synchronous)
  const statistical = runStatisticalEval(agentId, parsedOutput);
  console.log(`     Statistical: score=${statistical.score.toFixed(2)}`);

  // Layer 3: LLM Judge (async — calls Gemini)
  const llmResult = await runLLMJudge(agentId, agentOutputRaw, context);
  console.log(`     LLM Judge: ${llmResult.overallVerdict} (score=${llmResult.aggregateScore})`);

  // Merge
  const report = mergeEvalResults(agentId, structural, statistical, llmResult, retryAttempt);
  console.log(`  📊 [EVAL] Final verdict for ${agentId}: ${report.overallVerdict} (${report.aggregateScore})`);

  if (report.blockingIssues.length > 0) {
    console.log(`  ⛔ Blocking issues:`);
    report.blockingIssues.forEach((issue) => console.log(`     • ${issue}`));
  }
  if (report.warnings.length > 0) {
    console.log(`  ⚠️  Warnings:`);
    report.warnings.forEach((w) => console.log(`     • ${w}`));
  }

  return report;
}

/**
 * Build a retry prompt that injects the eval report so the agent
 * knows exactly what to fix on the next attempt.
 */
export function buildRetryPrompt(
  originalPrompt: string,
  evalReport: EvalReport
): string {
  return `
${originalPrompt}

--- IMPORTANT: SELF-CORRECTION REQUIRED ---
Your previous output was evaluated and received verdict: ${evalReport.overallVerdict}
(score: ${evalReport.aggregateScore}/1.0)

You MUST fix the following issues before responding:

BLOCKING ISSUES (must fix):
${evalReport.blockingIssues.map((i) => `• ${i}`).join("\n")}

WARNINGS (should fix):
${evalReport.warnings.map((w) => `• ${w}`).join("\n")}

SPECIFIC IMPROVEMENTS NEEDED:
${evalReport.improvementSuggestions.map((s) => `• ${s}`).join("\n")}

Please produce a corrected version of your output now, addressing all the issues above.
`;
}

/**
 * Build the pipeline eval summary from all agent reports.
 */
export function buildPipelineSummary(
  pipelineRunId: string,
  startedAt: string,
  agentReports: EvalReport[],
  halted: boolean,
  haltReason?: string
): PipelineEvalSummary {
  const totalRetries = agentReports.reduce((sum, r) => sum + r.retryAttempt, 0);
  const anyFail = agentReports.some((r) => r.overallVerdict === "FAIL");
  const anyWarn = agentReports.some((r) => r.overallVerdict === "WARN");

  return {
    pipelineRunId,
    startedAt,
    completedAt: new Date().toISOString(),
    overallPipelineStatus: anyFail ? "FAIL" : anyWarn ? "WARN" : "PASS",
    agentReports,
    totalRetries,
    halted,
    haltReason,
  };
}

