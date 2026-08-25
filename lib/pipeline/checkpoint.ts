import type { ChunkEvidencePack } from "@/lib/ai/aggregateEvidence";
import type { ModelDimensionOutput } from "@/lib/validation/schemas";
import type { EvaluationStage } from "@/lib/pipeline/stages";

export const CHECKPOINT_KIND = "beavermind_checkpoint" as const;

/**
 * Internal pipeline resume state stored in `evaluations.result` between
 * hosting invocations. Never sent to the client (stripped in toClientEvaluation).
 *
 * Scoring/rubric semantics are unchanged — this only splits Option C′ model
 * calls so a long coaching transcript can finish under Vercel time limits.
 */
export interface PipelineCheckpoint {
  kind: typeof CHECKPOINT_KIND;
  version: 1;
  phase: "extract" | "synthesis_first" | "synthesis_second";
  packs: ChunkEvidencePack[];
  nextChunkIndex: number;
  chunkCount: number;
  modelCallCount: number;
  firstDimensions?: ModelDimensionOutput[];
  /** Coach-facing live status. Safe to send to the client; packs are not. */
  progress?: string;
}

export function isPipelineCheckpoint(
  value: unknown,
): value is PipelineCheckpoint {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === CHECKPOINT_KIND && record.version === 1;
}

export function checkpointStage(checkpoint: PipelineCheckpoint): EvaluationStage {
  if (checkpoint.phase === "extract") return "extracting_evidence";
  if (checkpoint.phase === "synthesis_first") return "aggregating_evidence";
  return "evaluating";
}

export function clientProgressMessage(result: unknown): string | null {
  if (!isPipelineCheckpoint(result)) return null;
  const text = result.progress?.trim();
  return text ? text : null;
}
