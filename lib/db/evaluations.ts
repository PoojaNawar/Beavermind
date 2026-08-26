import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  canClaimEvaluation,
} from "@/lib/processing/lease";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import {
  coarseStatusFromStage,
  stageFromLegacyStatus,
  type EvaluationStage,
} from "@/lib/pipeline/stages";
import type {
  CallType,
  EvaluationRecord,
  EvaluationResult,
  EvaluationStatus,
  ProcessingPath,
} from "@/lib/rubrics/types";
import {
  checkpointStage,
  clientProgressMessage,
  isPipelineCheckpoint,
  type PipelineCheckpoint,
} from "@/lib/pipeline/checkpoint";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";

export interface EvaluationRow {
  id: string;
  call_type: CallType;
  transcript: string;
  client_name?: string | null;
  coach_name?: string | null;
  client_details?: string | null;
  status: EvaluationStatus;
  stage: string | null;
  result: EvaluationResult | PipelineCheckpoint | null;
  error_message: string | null;
  rubric_version: string;
  model_name: string | null;
  provider: string | null;
  pipeline_version: string | null;
  processing_path: ProcessingPath | null;
  chunk_count: number | null;
  model_call_count: number | null;
  retry_count: number | null;
  processing_duration_ms: number | null;
  evidence_count: number | null;
  verified_evidence_count: number | null;
  rejected_evidence_count: number | null;
  processing_started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = env.supabaseUrl();
  const key = env.supabaseSecret();

  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function rowToRecord(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    callType: row.call_type,
    transcript: row.transcript,
    clientName: row.client_name ?? null,
    coachName: row.coach_name ?? null,
    clientDetails: row.client_details ?? null,
    status: row.status,
    stage: row.stage ?? null,
    result: row.result as EvaluationRecord["result"],
    errorMessage: row.error_message,
    rubricVersion: row.rubric_version,
    modelName: row.model_name,
    processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit: {
      provider: row.provider ?? null,
      pipelineVersion: row.pipeline_version ?? null,
      processingPath: row.processing_path ?? null,
      chunkCount: row.chunk_count ?? null,
      modelCallCount: row.model_call_count ?? null,
      retryCount: row.retry_count ?? 0,
      processingDurationMs: row.processing_duration_ms ?? null,
      evidenceCount: row.evidence_count ?? null,
      verifiedEvidenceCount: row.verified_evidence_count ?? null,
      rejectedEvidenceCount: row.rejected_evidence_count ?? null,
    },
  };
}

export async function createEvaluation(args: {
  callType: CallType;
  transcript: string;
  rubricVersion: string;
  clientName: string;
  coachName: string | null;
  clientDetails: string | null;
}): Promise<EvaluationRecord> {
  const supabase = getSupabaseAdmin();
  const baseRow = {
    call_type: args.callType,
    transcript: args.transcript,
    status: "pending" as const,
    stage: "pending",
    rubric_version: args.rubricVersion,
    pipeline_version: PIPELINE_VERSION,
    retry_count: 0,
  };

  let { data, error } = await supabase
    .from("evaluations")
    .insert({
      ...baseRow,
      client_name: args.clientName,
      coach_name: args.coachName,
      client_details: args.clientDetails,
    })
    .select("*")
    .single();

  if (error && /client_name|coach_name|client_details|schema cache/i.test(error.message)) {
    console.warn(
      "[evaluations] Subject columns missing. Creating the row without them. Run supabase/migrations/003_subject.sql so client/coach persist.",
    );
    const retry = await supabase.from("evaluations").insert(baseRow).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    throw new Error(
      `Database error creating evaluation: ${error?.message ?? "unknown"}`,
    );
  }

  const record = rowToRecord(data as EvaluationRow);
  if (!record.clientName && args.clientName) {
    return {
      ...record,
      clientName: args.clientName,
      coachName: args.coachName,
      clientDetails: args.clientDetails,
    };
  }
  return record;
}

export async function getEvaluation(
  id: string,
): Promise<EvaluationRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error loading evaluation: ${error.message}`);
  }
  if (!data) return null;
  return rowToRecord(data as EvaluationRow);
}

/** Polling payload: never include the full transcript or resume checkpoints. */
export function toClientEvaluation(record: EvaluationRecord) {
  const { transcript: _transcript, result, ...rest } = record;
  const safeResult = isPipelineCheckpoint(result)
    ? null
    : result
      ? hydrateCompletedReport(result, _transcript)
      : null;
  return {
    ...rest,
    result: safeResult,
    progressMessage: clientProgressMessage(result),
    stage: stageFromLegacyStatus(record.status, record.stage),
  };
}

export type EvaluationPatch = Partial<{
  status: EvaluationStatus;
  stage: EvaluationStage;
  result: EvaluationResult | PipelineCheckpoint | null;
  error_message: string | null;
  model_name: string | null;
  provider: string | null;
  pipeline_version: string | null;
  processing_path: ProcessingPath | null;
  chunk_count: number | null;
  model_call_count: number | null;
  retry_count: number;
  processing_duration_ms: number | null;
  evidence_count: number | null;
  verified_evidence_count: number | null;
  rejected_evidence_count: number | null;
  processing_started_at: string | null;
  completed_at: string | null;
}>;

export async function updateEvaluation(
  id: string,
  patch: EvaluationPatch,
): Promise<EvaluationRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("evaluations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Database error updating evaluation: ${error?.message ?? "unknown"}`);
  }
  return rowToRecord(data as EvaluationRow);
}

export async function setEvaluationStage(
  id: string,
  stage: EvaluationStage,
): Promise<void> {
  await updateEvaluation(id, {
    stage,
    status: coarseStatusFromStage(stage),
  });
}

/**
 * Claim a pending/failed evaluation for processing.
 * Reclaims processing only when the lease (updated_at heartbeat) has expired,
 * so a live multi-minute chunked run is not stolen by retry.
 * Same evaluation ID — never inserts a second row.
 */
export async function claimForProcessing(
  id: string,
): Promise<EvaluationRecord | null> {
  const existing = await getEvaluation(id);
  if (!existing) return null;

  const decision = canClaimEvaluation({
    status: existing.status,
    updatedAt: existing.updatedAt,
  });
  if (!decision.claimable) {
    return null;
  }

  const nextRetry =
    existing.status === "failed" || decision.reason === "stale-processing"
      ? existing.audit.retryCount + 1
      : existing.audit.retryCount;

  const now = new Date().toISOString();
  const checkpoint = isPipelineCheckpoint(existing.result)
    ? existing.result
    : null;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("evaluations")
    .update({
      status: "processing",
      stage: checkpoint ? checkpointStage(checkpoint) : "pending",
      processing_started_at:
        checkpoint && existing.processingStartedAt
          ? existing.processingStartedAt
          : now,
      error_message: null,
      completed_at: null,
      retry_count: nextRetry,
      pipeline_version: PIPELINE_VERSION,
    })
    .eq("id", id)
    .eq("updated_at", existing.updatedAt);

  if (existing.status === "processing") {
    query = query.eq("status", "processing");
  } else {
    query = query.in("status", ["pending", "failed"]);
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(`Database error claiming evaluation: ${error.message}`);
  }
  if (!data) return null;
  return rowToRecord(data as EvaluationRow);
}

/**
 * Refresh the processing lease (bumps updated_at via DB trigger).
 * Called on a timer while evaluateCall runs.
 */
export async function touchProcessingLease(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("evaluations")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "processing");

  if (error) {
    throw new Error(`Database error touching processing lease: ${error.message}`);
  }
}
