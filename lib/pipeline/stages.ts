import type { EvaluationStatus } from "@/lib/rubrics/types";

/**
 * Worker-facing pipeline stage. Persisted in Supabase.
 *
 * Coarse `status` (pending/processing/completed/failed) remains the lease lock.
 * Stage is the fine-grained progress the UI must display — never inferred
 * from timers.
 */
export const EVALUATION_STAGES = [
  "pending",
  "extracting_evidence",
  "aggregating_evidence",
  "evaluating",
  "validating",
  "scoring",
  "completed",
  "failed",
] as const;

export type EvaluationStage = (typeof EVALUATION_STAGES)[number];

export const IN_FLIGHT_STAGES: readonly EvaluationStage[] = [
  "extracting_evidence",
  "aggregating_evidence",
  "evaluating",
  "validating",
  "scoring",
];

export const PROCESSING_STEP_ORDER = [
  "extracting_evidence",
  "aggregating_evidence",
  "evaluating",
  "validating",
  "scoring",
  "completed",
] as const;

const ALLOWED_TRANSITIONS: Record<EvaluationStage, readonly EvaluationStage[]> =
  {
    pending: ["extracting_evidence", "evaluating", "failed"],
    extracting_evidence: ["aggregating_evidence", "evaluating", "failed"],
    aggregating_evidence: ["evaluating", "failed"],
    evaluating: ["validating", "failed"],
    validating: ["scoring", "failed"],
    scoring: ["completed", "failed"],
    completed: [],
    failed: ["pending", "extracting_evidence", "evaluating"],
  };

export function isEvaluationStage(value: string): value is EvaluationStage {
  return (EVALUATION_STAGES as readonly string[]).includes(value);
}

export function isInFlightStage(stage: EvaluationStage): boolean {
  return IN_FLIGHT_STAGES.includes(stage);
}

export function coarseStatusFromStage(stage: EvaluationStage): EvaluationStatus {
  if (stage === "pending") return "pending";
  if (stage === "completed") return "completed";
  if (stage === "failed") return "failed";
  return "processing";
}

/**
 * Map a legacy row that only has coarse status. Do not invent in-flight
 * stages for historical processing rows.
 */
export function stageFromLegacyStatus(
  status: EvaluationStatus,
  storedStage: string | null | undefined,
): EvaluationStage | null {
  if (storedStage && isEvaluationStage(storedStage)) return storedStage;
  if (status === "pending") return "pending";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return null;
}

export function canTransition(
  from: EvaluationStage,
  to: EvaluationStage,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: EvaluationStage,
  to: EvaluationStage,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid pipeline transition: ${from} → ${to}`);
  }
}
