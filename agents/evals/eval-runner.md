# Eval Runner — Core Evaluation Orchestrator

| Property | Value |
|----------|-------|
| **File** | `evals/eval-runner.ts` |
| **Purpose** | Runs all three eval layers for a given agent, merges scores, handles retry prompt injection, and produces the pipeline summary |
| **Used By** | `orchestrator.ts` |
| **Calls** | `agent1-evals.ts` – `agent4-evals.ts` (structural + statistical), Gemini API (LLM judge) |

---

## Overview

The eval runner is the **central coordinator** of the evaluation system. For each agent, it:

1. Runs Layer 1 (Structural) — synchronous schema check
2. Runs Layer 2 (Statistical) — synchronous count/pattern checks
3. Runs Layer 3 (LLM-as-Judge) — async Gemini API call
4. Merges the three results into a single `EvalReport`
5. Returns the verdict to the orchestrator

---

## Three-Layer Merge Logic

```
Final Score = (StatisticalScore × 0.30) + (LLMScore × 0.70)

If Structural FAIL → Final Score = 0.0  (automatic FAIL — no need to call LLM)
```

### Score → Verdict

| Score | Verdict | Orchestrator Action |
|-------|---------|-------------------|
| ≥ 0.85 + no blocking issues | PASS ✅ | Proceed to next agent |
| 0.65–0.84 + no blocking issues | WARN ⚠️ | Proceed, log warnings |
| < 0.65 OR any blocking issue | FAIL ❌ | Inject self-correction, retry |

---

## LLM-as-Judge System Instruction

The judge receives this system instruction at every invocation:

```
ROLE: Independent AI Evaluator — QE Pipeline Judge

You are an expert QA architect and SDET evaluating outputs produced by other
AI agents in a quality engineering pipeline for InvenTree.

VERDICT RULES:
- PASS: aggregate_score >= 0.85 AND no blocking_issues
- WARN: aggregate_score >= 0.65 AND no blocking_issues
- FAIL: aggregate_score < 0.65 OR any blocking_issue present

BLOCKING ISSUES (automatic FAIL):
- Required JSON schema fields missing or wrong type
- Agent violated an explicit "DO NOT" rule
- Hardcoded credentials found in generated code
- P0 test cases missing from automation coverage

RULES:
1. Be critical but fair — score based on evidence in the output, not assumptions.
2. Never inflate scores.
3. Cite specific field names or values for every score.
4. Respond ONLY with the JSON object, no markdown fences.
```

---

## LLM Judge Prompts per Agent

The judge receives a **different evaluation prompt** depending on which agent is being assessed, with the agent's output injected:

| Agent | Key Dimensions Evaluated |
|-------|-------------------------|
| `requirements-analyst` | Schema, domain coverage, business rule specificity, endpoint accuracy, UI flow clarity |
| `test-design-engineer` | Schema, case counts, scenario diversity, FA traceability, test data quality, P0 distribution |
| `api-automation-engineer` | Schema, required files, code correctness, security (no secrets), P0 coverage, cleanup hooks |
| `ui-automation-engineer` | Schema, POM completeness, locator quality, security, test independence, assertion quality |

---

## Retry + Self-Correction Prompt

When a FAIL verdict is returned, the orchestrator calls `buildRetryPrompt()` to construct a new prompt that includes the original instructions **plus** the specific issues to fix:

```
[Original prompt text]

--- IMPORTANT: SELF-CORRECTION REQUIRED ---
Your previous output was evaluated and received verdict: FAIL (score: 0.52/1.0)

You MUST fix the following issues before responding:

BLOCKING ISSUES (must fix):
• test_suite.total_cases (30) does not match actual array length (28)
• Part Delete (FA-006) has only 5 API test cases — below minimum of 8

WARNINGS (should fix):
• No auth failure test for PATCH endpoint

SPECIFIC IMPROVEMENTS NEEDED:
• Add 3 more TC-API cases for FA-006: delete with BOM reference, delete with stock, delete confirmed
• Add TC-API-0xx: PATCH /api/part/{id}/ without Authorization header → expect 401

Please produce a corrected version now.
```

**Maximum retries:** 2 (configurable via `DEFAULT_RETRY_CONFIG.maxRetries`)  
**Backoff:** 1 second × attempt number between retries

---

## Public API

### `evaluateAgent()`

```typescript
async function evaluateAgent(
  agentId: string,
  agentOutputRaw: string,    // raw string from agent (may include fences)
  retryAttempt: number,      // 0 = first attempt
  context?: string           // ground truth for traceability (e.g. requirements brief)
): Promise<EvalReport>
```

**Called by:** `orchestrator.ts` after every agent invocation.

---

### `buildRetryPrompt()`

```typescript
function buildRetryPrompt(
  originalPrompt: string,
  evalReport: EvalReport
): string
```

**Called by:** `orchestrator.ts` when `evalReport.overallVerdict === "FAIL"`.  
Injects blocking issues, warnings, and improvement suggestions into the next prompt.

---

### `buildPipelineSummary()`

```typescript
function buildPipelineSummary(
  pipelineRunId: string,
  startedAt: string,
  agentReports: EvalReport[],
  halted: boolean,
  haltReason?: string
): PipelineEvalSummary
```

**Called by:** `orchestrator.ts` at the very end of the pipeline.  
Produces `00-pipeline-eval-summary.json`.

---

## Console Output Format

The runner prints a structured eval summary for each agent:

```
  🔍 [EVAL] Running evals for: test-design-engineer (attempt 0)
     Structural: ✅ PASS
     Statistical: score=0.71
     LLM Judge: WARN (score=0.79)
  📊 [EVAL] Final verdict for test-design-engineer: WARN (0.77)
  ⚠️  Warnings:
     • Part Delete (FA-006) has only 5 API test cases — below minimum of 8
     • No auth failure test for PATCH endpoint
```

---

## Artefact Output

| File | Contents |
|------|---------|
| `agent-artifacts/logs/evals/eval-requirements-analyst.json` | EvalReport for Agent 1 |
| `agent-artifacts/logs/evals/eval-test-design-engineer.json` | EvalReport for Agent 2 |
| `agent-artifacts/logs/evals/eval-api-automation-engineer.json` | EvalReport for Agent 3 |
| `agent-artifacts/logs/evals/eval-ui-automation-engineer.json` | EvalReport for Agent 4 |
| `agent-artifacts/logs/00-pipeline-eval-summary.json` | Rolled-up pipeline summary |
