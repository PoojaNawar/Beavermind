import { describe, expect, it } from "vitest";
import {
  EVIDENCE_INSUFFICIENT_NOTE,
  capScoreWithoutVerifiedEvidence,
  reconcileDimensionAfterVerification,
} from "@/lib/transcripts/evidencePolicy";

function dim(
  overrides: Partial<
    Parameters<typeof reconcileDimensionAfterVerification>[0]
  > = {},
) {
  return reconcileDimensionAfterVerification(
    {
      id: "d6",
      score: 7,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: "Strong",
      rationale: "Coach prepared the client for valleys.",
      evidence: [
        {
          quote: "The coach booked a Hawaiian vacation together",
          speaker: "Coach",
          location: null,
          demonstrated: false,
          verificationStatus: "unverified",
        },
      ],
      quickFix: "Revisit valleys.",
      notDemonstrated: false,
      ...overrides,
    },
    { maxScore: 10, discreteScores: [0, 3, 7, 10] },
  );
}

describe("evidence / score consistency policy", () => {
  it("caps Elite when only unverified quotes support the score", () => {
    const result = dim({
      score: 10,
      rationale: "The client clearly stated their 12-month vision.",
    });
    expect(result.score).toBe(7);
    expect(result.notDemonstrated).toBe(false);
    expect(result.rationale).toMatch(/does not provide sufficient verified evidence/i);
    expect(result.rationale).toContain("[Verification:");
    expect(result.rationale).toContain(EVIDENCE_INSUFFICIENT_NOTE.trim());
  });

  it("preserves a below-Elite score when quotes were unverified", () => {
    const result = dim({ score: 7 });
    expect(result.score).toBe(7);
    expect(result.notDemonstrated).toBe(false);
    expect(result.rationale).toContain("[Verification:");
  });

  it("does not infer notDemonstrated solely from quote match failure", () => {
    const result = dim({ notDemonstrated: false });
    expect(result.notDemonstrated).toBe(false);
  });

  it("keeps model notDemonstrated when already asserted", () => {
    const result = dim({
      notDemonstrated: true,
      score: 0,
      evidence: [
        {
          quote: "Not demonstrated in transcript",
          speaker: null,
          location: null,
          demonstrated: false,
          verificationStatus: "not_demonstrated",
        },
      ],
    });
    expect(result.notDemonstrated).toBe(true);
    expect(result.rationale).not.toContain("[Verification:");
  });

  it("does not cap when verified evidence remains", () => {
    const result = dim({
      score: 10,
      evidence: [
        {
          quote: "real quote from the call that is long enough",
          speaker: "Coach",
          location: null,
          demonstrated: true,
          verificationStatus: "verified",
        },
        {
          quote: "fake quote that was not in the transcript",
          speaker: "Coach",
          location: null,
          demonstrated: false,
          verificationStatus: "unverified",
        },
      ],
    });
    expect(result.rationale).not.toContain("[Verification:");
    expect(result.score).toBe(10);
  });

  it("maps discrete Elite to the next lower band", () => {
    expect(capScoreWithoutVerifiedEvidence(15, 15, [0, 5, 10, 15])).toBe(10);
    expect(capScoreWithoutVerifiedEvidence(10, 10, [0, 3, 7, 10])).toBe(7);
    expect(capScoreWithoutVerifiedEvidence(7, 10, [0, 3, 7, 10])).toBe(7);
  });
});
