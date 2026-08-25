import { evaluateCall } from "@/lib/ai/evaluateCall";
import { getEvaluationModel } from "@/lib/ai/provider";
import {
  claimForProcessing,
  getEvaluation,
  setEvaluationStage,
  touchProcessingLease,
  updateEvaluation,
} from "@/lib/db/evaluations";
import { publicErrorMessage, sanitizeDiagnostic } from "@/lib/errors/evaluationError";
import {
  checkpointStage,
  isPipelineCheckpoint,
} from "@/lib/pipeline/checkpoint";
import {
  assertTransition,
  canTransition,
  isEvaluationStage,
  type EvaluationStage,
} from "@/lib/pipeline/stages";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import {
  canClaimEvaluation,
  startProcessingHeartbeat,
} from "@/lib/processing/lease";
import { needsChunking } from "@/lib/transcripts/handling";

/**
 * Process an evaluation. On Vercel this is one model call then a checkpoint
 * so long chunked transcripts can finish across invocations.
 *
 * Same evaluation ID is reused on retry — never a second row.
 */
export async function processEvaluation(
  id: string,
): Promise<"idle" | "yielded" | "completed" | "failed"> {
  const existing = await getEvaluation(id);
  if (!existing) return "idle";
  if (existing.status === "completed") return "completed";

  if (existing.status === "processing") {
    const decision = canClaimEvaluation({
      status: existing.status,
      updatedAt: existing.updatedAt,
    });
    if (!decision.claimable) {
      return "idle";
    }
  }

  const claimed = await claimForProcessing(id);
  if (!claimed) {
    return "idle";
  }

  const stopHeartbeat = startProcessingHeartbeat(() =>
    touchProcessingLease(id),
  );

  let stage: EvaluationStage =
    claimed.stage && isEvaluationStage(claimed.stage)
      ? claimed.stage
      : "pending";

  const onStage = async (next: EvaluationStage) => {
    assertTransition(stage, next);
    stage = next;
    await setEvaluationStage(id, next);
  };

  try {
    const { provider, modelName } = getEvaluationModel();
    const processingPath = needsChunking(claimed.transcript, claimed.callType)
      ? "chunked"
      : "single";

    await updateEvaluation(id, {
      provider,
      model_name: modelName,
      pipeline_version: PIPELINE_VERSION,
      processing_path: processingPath,
    });

    const outcome = await evaluateCall({
      callType: claimed.callType,
      transcript: claimed.transcript,
      onStage,
      checkpoint: isPipelineCheckpoint(claimed.result) ? claimed.result : null,
    });

    if (!outcome.done) {
      await updateEvaluation(id, {
        status: "pending",
        stage: checkpointStage(outcome.checkpoint),
        result: outcome.checkpoint,
        model_name: outcome.stats.modelName,
        provider: outcome.stats.provider,
        pipeline_version: outcome.stats.pipelineVersion,
        processing_path: outcome.stats.processingPath,
        chunk_count: outcome.stats.chunkCount,
        model_call_count: outcome.stats.modelCallCount,
        error_message: null,
      });
      return "yielded";
    }

    const started = claimed.processingStartedAt
      ? Date.parse(claimed.processingStartedAt)
      : Date.now();
    const durationMs = Math.max(0, Date.now() - started);
    const quality = outcome.result.evidenceQuality;

    await onStage("completed");
    await updateEvaluation(id, {
      status: "completed",
      stage: "completed",
      result: outcome.result,
      model_name: outcome.stats.modelName,
      provider: outcome.stats.provider,
      pipeline_version: outcome.stats.pipelineVersion,
      processing_path: outcome.stats.processingPath,
      chunk_count: outcome.stats.chunkCount,
      model_call_count: outcome.stats.modelCallCount,
      processing_duration_ms: durationMs,
      evidence_count: quality.found,
      verified_evidence_count: quality.verified,
      rejected_evidence_count: quality.rejected,
      completed_at: new Date().toISOString(),
      error_message: null,
    });
    return "completed";
  } catch (err) {
    console.warn(`[evaluation ${id}] ${sanitizeDiagnostic(err)}`);
    try {
      if (canTransition(stage, "failed")) {
        await setEvaluationStage(id, "failed");
      }
      await updateEvaluation(id, {
        status: "failed",
        stage: "failed",
        error_message: publicErrorMessage(err),
        completed_at: new Date().toISOString(),
      });
    } catch (persistErr) {
      console.warn(
        `[evaluation ${id}] failed to persist error: ${sanitizeDiagnostic(persistErr)}`,
      );
    }
    return "failed";
  } finally {
    stopHeartbeat();
  }
}
