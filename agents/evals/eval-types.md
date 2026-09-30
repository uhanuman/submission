# Eval Types — Shared Type Definitions

| Property | Value |
|----------|-------|
| **File** | `evals/eval-types.ts` |
| **Purpose** | Shared TypeScript interfaces used across all eval modules |
| **Used By** | `eval-runner.ts`, `agent1-evals.ts` through `agent4-evals.ts`, `orchestrator.ts` |

---

## Overview

All three eval layers (structural, statistical, LLM-as-Judge) share a common type contract. This file defines the canonical shapes so every module in the eval system speaks the same language.

---

## Core Status

```typescript
type EvalStatus = "PASS" | "WARN" | "FAIL";
```

| Value | Meaning | Pipeline Action |
|-------|---------|----------------|
| `PASS` | Score ≥ 0.85, no blocking issues | Proceed to next agent |
| `WARN` | Score 0.65–0.84, no blocking issues | Proceed with logged warnings |
| `FAIL` | Score < 0.65 OR blocking issue exists | Retry agent (up to 2×) |

---

## `EvalDimension`

Represents the result of a single scored evaluation criterion within an agent's report.

```typescript
interface EvalDimension {
  dimension: string;   // Human-readable name e.g. "Schema Compliance"
  weight: number;      // Contribution to aggregate score (0.0 – 1.0, sum to 1.0 per agent)
  score: number;       // Achieved score for this dimension (0.0 – 1.0)
  status: EvalStatus;  // Derived from score + threshold
  rationale: string;   // Evidence-based explanation of the score
  issues: string[];    // Specific problems found (empty if PASS)
}
```

**Example:**
```json
{
  "dimension": "Count Adequacy",
  "weight": 0.25,
  "score": 0.75,
  "status": "WARN",
  "rationale": "Part Delete has only 5 API cases, minimum is 8",
  "issues": ["FA-006 (Part Delete) has 5 API cases, expected ≥8"]
}
```

---

## `EvalReport`

The complete evaluation output for one agent on one attempt. Produced by merging all three eval layers.

```typescript
interface EvalReport {
  agentId: string;           // e.g. "requirements-analyst"
  evalTimestamp: string;     // ISO 8601
  evalType: EvalType[];      // which layers ran: ["structural","statistical","llm-judge"]
  overallVerdict: EvalStatus;
  retryRecommended: boolean;
  retryAttempt: number;      // 0 = first run, 1 = first retry, 2 = second retry
  dimensions: EvalDimension[];
  aggregateScore: number;    // weighted average (0.0 – 1.0)
  blockingIssues: string[];  // must be empty for PASS/WARN
  warnings: string[];        // non-blocking concerns
  improvementSuggestions: string[];
}

type EvalType = "structural" | "statistical" | "llm-judge";
```

---

## `PipelineEvalSummary`

Rolled-up summary of all agent eval reports for a single pipeline run.

```typescript
interface PipelineEvalSummary {
  pipelineRunId: string;           // UUID v4 generated at run start
  startedAt: string;               // ISO 8601
  completedAt: string;             // ISO 8601
  overallPipelineStatus: EvalStatus;
  agentReports: EvalReport[];      // one per agent (including retries)
  totalRetries: number;            // sum of all retryAttempt values
  halted: boolean;                 // true if pipeline stopped early
  haltReason?: string;             // set if halted === true
}
```

**Overall Pipeline Status Logic:**
```
ANY agent FAIL  → overallPipelineStatus = "FAIL"
ANY agent WARN  → overallPipelineStatus = "WARN"
ALL agents PASS → overallPipelineStatus = "PASS"
```

---

## `RetryConfig`

Controls retry behaviour when an agent fails evaluation.

```typescript
interface RetryConfig {
  maxRetries: number;   // Maximum retry attempts (default: 2)
  retryOnWarn: boolean; // Whether to retry on WARN (default: false)
  backoffMs: number;    // Delay between retries in ms (default: 1000)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  retryOnWarn: false,
  backoffMs: 1000,
};
```

---

## `EVAL_THRESHOLDS`

Score boundaries used to derive `EvalStatus` from a raw score.

```typescript
const EVAL_THRESHOLDS = {
  PASS_MIN_SCORE: 0.85,
  WARN_MIN_SCORE: 0.65,
} as const;
```

| Score Range | → Status |
|------------|----------|
| `score >= 0.85` | `PASS` |
| `0.65 <= score < 0.85` | `WARN` |
| `score < 0.65` | `FAIL` |

---

## Type Dependency Map

```
orchestrator.ts
    └── imports: EvalReport, PipelineEvalSummary, DEFAULT_RETRY_CONFIG

eval-runner.ts
    └── imports: EvalReport, EvalStatus, EvalType, PipelineEvalSummary,
                 RetryConfig, DEFAULT_RETRY_CONFIG, EVAL_THRESHOLDS

agent1-evals.ts  ─┐
agent2-evals.ts  ─┤  (each exports two functions only — no type imports needed)
agent3-evals.ts  ─┤
agent4-evals.ts  ─┘
```
