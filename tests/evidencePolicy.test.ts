import { describe, expect, it } from "vitest";
import {
  EVIDENCE_INSUFFICIENT_NOTE,
  reconcileDimensionAfterVerification,
} from "@/lib/transcripts/evidencePolicy";

function dim(
  overrides: Partial<
    Parameters<typeof reconcileDimensionAfterVerification>[0]
  > = {},
) {
  return reconcileDimensionAfterVerification({
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
  });
}

describe("evidence / score consistency policy", () => {
  it("preserves score when verified quotes were stripped", () => {
    const result = dim();
    expect(result.score).toBe(7);
    expect(result.notDemonstrated).toBe(false);
    expect(result.rationale).toContain("[Verification:");
    expect(result.rationale).toContain(EVIDENCE_INSUFFICIENT_NOTE.trim());
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

  it("does not add verification note when verified evidence remains", () => {
    const result = dim({
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
    expect(result.score).toBe(7);
  });
});
