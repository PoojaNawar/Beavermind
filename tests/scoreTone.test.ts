import { describe, expect, it } from "vitest";
import type { DimensionResult } from "@/lib/rubrics/types";
import {
  dimensionTone,
  isHighWeightDimension,
  scoredRationale,
} from "@/lib/ui/scoreTone";

function dim(partial: Partial<DimensionResult>): DimensionResult {
  return {
    id: "d1",
    name: "Check-In & Connection",
    score: 7,
    maxScore: 10,
    disabled: false,
    disabledReason: null,
    notApplicable: false,
    notApplicableReason: null,
    band: "Strong",
    rationale: "The coach asked about wins but skipped intention.",
    evidence: [],
    quickFix: "Set a tailored intention.",
    notDemonstrated: false,
    evidenceFound: true,
    verifiedEvidenceCount: 1,
    rejectedEvidenceCount: 0,
    evidenceStrength: "medium",
    ...partial,
  };
}

describe("score presentation helpers", () => {
  it("colors mid-range scores as mid", () => {
    expect(dimensionTone(dim({ score: 7, maxScore: 10 }))).toBe("mid");
    expect(dimensionTone(dim({ score: 10, maxScore: 10 }))).toBe("good");
    expect(dimensionTone(dim({ score: 3, maxScore: 10 }))).toBe("bad");
  });

  it("stars dimensions worth 10+ points", () => {
    expect(isHighWeightDimension(dim({ maxScore: 10 }))).toBe(true);
    expect(isHighWeightDimension(dim({ maxScore: 5 }))).toBe(false);
  });

  it("leads rationale with the score without rewriting existing scored copy", () => {
    expect(scoredRationale(dim({}))).toBe(
      "Scored 7/10 because The coach asked about wins but skipped intention.",
    );
    expect(
      scoredRationale(
        dim({ rationale: "Scored 7/10 because the check-in was warm." }),
      ),
    ).toBe("Scored 7/10 because the check-in was warm.");
  });
});
