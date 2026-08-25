import { describe, expect, it } from "vitest";
import { createEvaluationBodySchema } from "@/lib/validation/schemas";
import { validateTranscriptLength } from "@/lib/transcripts/handling";
import { canAcceptRetry } from "@/lib/processing/lease";

describe("API input contracts", () => {
  it("accepts a create payload with a valid call type and transcript", () => {
    const parsed = createEvaluationBodySchema.parse({
      callType: "kickoff",
      transcript: "[Dana]: Hello",
    });
    expect(parsed.callType).toBe("kickoff");
  });

  it("rejects an invalid call type", () => {
    const parsed = createEvaluationBodySchema.safeParse({
      callType: "sales",
      transcript: "[Dana]: Hello",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty transcript at the body schema", () => {
    const parsed = createEvaluationBodySchema.safeParse({
      callType: "coaching",
      transcript: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("create flow would fail closed on oversized transcripts", () => {
    const original = process.env.MAX_TRANSCRIPT_CHARS;
    process.env.MAX_TRANSCRIPT_CHARS = "50";
    expect(validateTranscriptLength("n".repeat(51)).ok).toBe(false);
    if (original === undefined) delete process.env.MAX_TRANSCRIPT_CHARS;
    else process.env.MAX_TRANSCRIPT_CHARS = original;
  });
});

describe("retry contract", () => {
  it("blocks retry of completed evaluations", () => {
    expect(
      canAcceptRetry({
        status: "completed",
        updatedAt: new Date().toISOString(),
      }).accept,
    ).toBe(false);
  });

  it("allows retry of failed evaluations on the same id", () => {
    const retry = canAcceptRetry({
      status: "failed",
      updatedAt: new Date().toISOString(),
    });
    expect(retry.accept).toBe(true);
  });

  it("does not accept retry while another worker holds an active lease", () => {
    const retry = canAcceptRetry({
      status: "processing",
      updatedAt: new Date().toISOString(),
    });
    expect(retry.accept).toBe(false);
    expect(retry.httpStatus).toBe(409);
  });
});
