/**
 * Eval Framework — Shared Types
 *
 * All structural, statistical, and LLM-as-Judge evaluators share these types.
 */

// ─── Core Status ─────────────────────────────────────────────────────────────

export type EvalStatus = "PASS" | "WARN" | "FAIL";

// ─── Individual Evaluator Result ─────────────────────────────────────────────

export interface EvalDimension {
  dimension: string;
  weight: number;          // 0.0 – 1.0 (must sum to 1.0 per agent)
  score: number;           // 0.0 – 1.0
  status: EvalStatus;
  rationale: string;
  issues: string[];
}

// ─── Full Eval Report (one per agent per run) ────────────────────────────────

export interface EvalReport {
  agentId: string;
  evalTimestamp: string;   // ISO 8601
  evalType: EvalType[];    // which eval layers ran
  overallVerdict: EvalStatus;
  retryRecommended: boolean;
  retryAttempt: number;    // 0 = first run, 1 = first retry, etc.
  dimensions: EvalDimension[];
  aggregateScore: number;  // weighted average
  blockingIssues: string[];
  warnings: string[];
  improvementSuggestions: string[];
}

export type EvalType = "structural" | "statistical" | "llm-judge";

// ─── Pipeline-level Eval Summary ─────────────────────────────────────────────

export interface PipelineEvalSummary {
  pipelineRunId: string;
  startedAt: string;
  completedAt: string;
  overallPipelineStatus: EvalStatus;
  agentReports: EvalReport[];
  totalRetries: number;
  halted: boolean;
  haltReason?: string;
}

// ─── Structural Eval Check ───────────────────────────────────────────────────

export interface StructuralCheck {
  checkId: string;
  description: string;
  evaluate(output: unknown): { passed: boolean; issues: string[] };
}

// ─── Statistical Eval Check ──────────────────────────────────────────────────

export interface StatisticalCheck {
  checkId: string;
  description: string;
  evaluate(output: unknown): { score: number; details: string };
}

// ─── Retry Config ────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;        // default: 2
  retryOnWarn: boolean;      // default: false — only retry on FAIL
  backoffMs: number;         // default: 1000
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  retryOnWarn: false,
  backoffMs: 1000,
};

// ─── Eval Thresholds ─────────────────────────────────────────────────────────

export const EVAL_THRESHOLDS = {
  PASS_MIN_SCORE: 0.85,
  WARN_MIN_SCORE: 0.65,
} as const;

