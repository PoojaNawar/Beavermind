import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_KIND,
  checkpointStage,
  isPipelineCheckpoint,
  type PipelineCheckpoint,
} from "@/lib/pipeline/checkpoint";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import { rowToRecord, toClientEvaluation, type EvaluationRow } from "@/lib/db/evaluations";

const checkpoint: PipelineCheckpoint = {
  kind: CHECKPOINT_KIND,
  version: 1,
  phase: "extract",
  packs: [
    {
      chunkIndex: 0,
      findings: [
        {
          dimensionId: "d1",
          quotes: [
            {
              quote: "SECRET QUOTE FROM TRANSCRIPT",
              speaker: "Marcus",
              location: null,
            },
          ],
          observations: "present",
        },
      ],
    },
  ],
  nextChunkIndex: 1,
  chunkCount: 6,
  modelCallCount: 1,
};

function baseRow(
  overrides: Partial<EvaluationRow> = {},
): EvaluationRow {
  return {
    id: "00000000-0000-0000-0000-000000000009",
    call_type: "coaching",
    transcript: "SECRET TRANSCRIPT CONTENT",
    status: "pending",
    stage: "extracting_evidence",
    result: null,
    error_message: null,
    rubric_version: "coaching-v1",
    model_name: "gpt-5-mini",
    provider: "openai",
    pipeline_version: PIPELINE_VERSION,
    processing_path: "chunked",
    chunk_count: 6,
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
    ...overrides,
  };
}

describe("pipeline checkpoints", () => {
  it("recognizes resume snapshots and maps them to UI stages", () => {
    expect(isPipelineCheckpoint(checkpoint)).toBe(true);
    expect(isPipelineCheckpoint({ overallScore: 90 })).toBe(false);
    expect(checkpointStage(checkpoint)).toBe("extracting_evidence");
    expect(
      checkpointStage({ ...checkpoint, phase: "synthesis_first" }),
    ).toBe("aggregating_evidence");
    expect(
      checkpointStage({ ...checkpoint, phase: "synthesis_second" }),
    ).toBe("evaluating");
  });

  it("strips checkpoint packs from the client polling payload", () => {
    const record = rowToRecord(
      baseRow({ result: checkpoint as EvaluationRow["result"] }),
    );
    const client = toClientEvaluation(record);
    expect(client.result).toBeNull();
    expect(JSON.stringify(client)).not.toContain("SECRET QUOTE FROM TRANSCRIPT");
    expect(JSON.stringify(client)).not.toContain("SECRET TRANSCRIPT CONTENT");
    expect(client.stage).toBe("extracting_evidence");
  });
});
