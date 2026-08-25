import { describe, expect, it } from "vitest";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import { rowToRecord, toClientEvaluation, type EvaluationRow } from "@/lib/db/evaluations";

describe("pipeline version", () => {
  it("exposes a single authoritative version string", () => {
    expect(PIPELINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is available on the evaluation record via row mapping", () => {
    const record = rowToRecord({
      id: "00000000-0000-0000-0000-000000000001",
      call_type: "kickoff",
      transcript: "[Dana]: hi",
      status: "pending",
      stage: "pending",
      result: null,
      error_message: null,
      rubric_version: "kickoff-v1",
      model_name: null,
      provider: null,
      pipeline_version: PIPELINE_VERSION,
      processing_path: null,
      chunk_count: null,
      model_call_count: null,
      retry_count: 0,
      processing_duration_ms: null,
      evidence_count: null,
      verified_evidence_count: null,
      rejected_evidence_count: null,
      processing_started_at: null,
      completed_at: null,
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    } satisfies EvaluationRow);

    expect(record.audit.pipelineVersion).toBe(PIPELINE_VERSION);
    expect(record.stage).toBe("pending");
  });

  it("hydrates missing historical audit fields without inventing values", () => {
    const record = rowToRecord({
      id: "00000000-0000-0000-0000-000000000002",
      call_type: "coaching",
      transcript: "[Dana]: hi",
      status: "completed",
      stage: null,
      result: null,
      error_message: null,
      rubric_version: "coaching-v1",
      model_name: "gpt-test",
      provider: null,
      pipeline_version: null,
      processing_path: null,
      chunk_count: null,
      model_call_count: null,
      retry_count: null,
      processing_duration_ms: null,
      evidence_count: null,
      verified_evidence_count: null,
      rejected_evidence_count: null,
      processing_started_at: null,
      completed_at: "2026-08-25T00:00:00.000Z",
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });

    expect(record.audit.pipelineVersion).toBeNull();
    expect(record.audit.processingPath).toBeNull();
    expect(record.audit.retryCount).toBe(0);
    expect(record.stage).toBeNull();
  });

  it("omits the transcript from the client polling payload", () => {
    const record = rowToRecord({
      id: "00000000-0000-0000-0000-000000000003",
      call_type: "kickoff",
      transcript: "SECRET TRANSCRIPT CONTENT",
      status: "processing",
      stage: "evaluating",
      result: null,
      error_message: null,
      rubric_version: "kickoff-v1",
      model_name: null,
      provider: "openai",
      pipeline_version: PIPELINE_VERSION,
      processing_path: "single",
      chunk_count: 1,
      model_call_count: 1,
      retry_count: 0,
      processing_duration_ms: null,
      evidence_count: null,
      verified_evidence_count: null,
      rejected_evidence_count: null,
      processing_started_at: "2026-08-25T00:00:00.000Z",
      completed_at: null,
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });
    const client = toClientEvaluation(record);
    expect(client).not.toHaveProperty("transcript");
    expect(JSON.stringify(client)).not.toContain("SECRET TRANSCRIPT CONTENT");
    expect(client.stage).toBe("evaluating");
    expect(client.progressMessage).toBeNull();
  });
});
