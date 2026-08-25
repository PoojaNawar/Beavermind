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
  assertTransition,
  canTransition,
  type EvaluationStage,
} from "@/lib/pipeline/stages";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import {
  canClaimEvaluation,
  startProcessingHeartbeat,
} from "@/lib/processing/lease";
import { needsChunking } from "@/lib/transcripts/handling";

/**
 * Process an evaluation end-to-end after the HTTP response (via after()).
 * Heartbeats the processing lease so long chunked runs are not reclaimed.
 *
 * Same evaluation ID is reused on retry — never a second row.
 */
export async function processEvaluation(id: string): Promise<void> {
  const existing = await getEvaluation(id);
  if (!existing) return;
  if (existing.status === "completed") return;

  if (existing.status === "processing") {
    const decision = canClaimEvaluation({
      status: existing.status,
      updatedAt: existing.updatedAt,
    });
    if (!decision.claimable) {
      return;
    }
  }

  const claimed = await claimForProcessing(id);
  if (!claimed) {
    return;
  }

  const stopHeartbeat = startProcessingHeartbeat(() =>
    touchProcessingLease(id),
  );

  let stage: EvaluationStage = "pending";

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

    const { result, stats } = await evaluateCall({
      callType: claimed.callType,
      transcript: claimed.transcript,
      onStage,
    });

    const started = claimed.processingStartedAt
      ? Date.parse(claimed.processingStartedAt)
      : Date.now();
    const durationMs = Math.max(0, Date.now() - started);
    const quality = result.evidenceQuality;

    await onStage("completed");
    await updateEvaluation(id, {
      status: "completed",
      stage: "completed",
      result,
      model_name: stats.modelName,
      provider: stats.provider,
      pipeline_version: stats.pipelineVersion,
      processing_path: stats.processingPath,
      chunk_count: stats.chunkCount,
      model_call_count: stats.modelCallCount,
      processing_duration_ms: durationMs,
      evidence_count: quality.found,
      verified_evidence_count: quality.verified,
      rejected_evidence_count: quality.rejected,
      completed_at: new Date().toISOString(),
      error_message: null,
    });
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
  } finally {
    stopHeartbeat();
  }
}
