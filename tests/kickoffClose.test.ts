import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import {
  applyKickoffCloseCalibration,
  kickoffHasEliteClose,
  kickoffHasStructuredRecap,
} from "@/lib/scoring/kickoffClose";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { EvaluationResult } from "@/lib/rubrics/types";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);

function stub(
  scores: Record<string, number | null>,
  rationale = "Quote-first: the coach said X.",
): ModelEvaluationOutput {
  const rubric = getKickoffRubric();
  return {
    oneThing: {
      recommendation: "Deepen rapport.",
      impact: "Client opens up.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "D2",
    },
    brief: "Strong kick-off.",
    redFlags: [],
    firedCapIds: [],
    notes: "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: scores[d.id] ?? 0,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale,
      evidence: [],
      quickFix: d.id === "d11" ? "Add a structured recap." : "",
      notDemonstrated: false,
    })),
  };
}

const ELITE_SCORES: Record<string, number | null> = {
  d1: 9,
  d2: 7,
  d3: 5,
  d4: 15,
  d5: 10,
  d6: 10,
  d7: 5,
  d8: 10,
  d9: 10,
  d10: 5,
  d11: 5,
  d12: 5,
};

describe("kickoff close calibration", () => {
  it("detects the elite recap, confidence, and emotion in kickoff-01", () => {
    expect(kickoffHasStructuredRecap(kickoff01)).toBe(true);
    expect(kickoffHasEliteClose(kickoff01)).toBe(true);
  });

  it("does not treat a short close as a structured recap", () => {
    const thin = "[Dana]: Ok, talk soon.\n[Owen]: Bye.";
    expect(kickoffHasStructuredRecap(thin)).toBe(false);
    expect(kickoffHasEliteClose(thin)).toBe(false);
  });

  it("does not cap D11 to 3 just because the rationale mentions a missing recap", () => {
    const result = applyCapsAndBuildResult({
      model: stub(ELITE_SCORES, "Typical gap: missing structured recap."),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    expect(result.overallScore).toBe(96);
  });

  it("restores D11 to 5 when kickoff-01 already has an elite close", () => {
    const scores = { ...ELITE_SCORES, d11: 3 };
    const result = applyCapsAndBuildResult({
      model: stub(scores, "No structured recap; generic close."),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    // kickoff-01 has no screen-share demo — D9 elite is 7, not 10.
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(7);
    expect(result.overallScore).toBe(93);
  });

  it("caps D11 at 3 when the transcript has no recap", () => {
    const thin = "[Dana]: Ok, talk soon.\n[Owen]: Bye.";
    const result = applyCapsAndBuildResult({
      model: stub(ELITE_SCORES),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: thin,
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(3);
    expect(result.dimensions.find((d) => d.id === "d6")?.score).toBe(7);
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(7);
  });

  it("repairs a stored 94 result when the transcript has the elite close", () => {
    const scored = applyCapsAndBuildResult({
      model: stub({ ...ELITE_SCORES, d11: 3 }),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    expect(scored.overallScore).toBe(94);
    const repaired = applyKickoffCloseCalibration(
      scored as EvaluationResult,
      kickoff01,
    );
    expect(repaired.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    expect(repaired.overallScore).toBe(96);
    expect(repaired.grade).toBe("Elite");
  });
});
