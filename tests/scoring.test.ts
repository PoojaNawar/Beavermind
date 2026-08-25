import { describe, expect, it } from "vitest";
import {
  applyCapsAndBuildResult,
  gradeFromScore,
  normalizeToHundred,
  sumDimensionScores,
} from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { Rubric } from "@/lib/rubrics/types";

function stubModel(
  rubric: Rubric,
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput>,
): ModelEvaluationOutput {
  return {
    oneThing: {
      recommendation: "Lock the next call live.",
      impact: "Continuity and accountability.",
      estimatedPointsGained: 5,
      scoreIfAppliedBasis: "D10 from 0 to 5",
    },
    brief: "A workable call with one clear miss.",
    redFlags: [],
    firedCapIds: extras?.firedCapIds ?? [],
    notes: extras?.notes ?? "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: scores[d.id] ?? 0,
      disabled: scores[d.id] === null && d.optional === true,
      disabledReason: scores[d.id] === null ? "no movement coaching" : null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale: "Quote-first: the coach said X.",
      evidence: [
        {
          quote: "Let's book next Tuesday at 3.",
          speaker: "Coach",
          location: "turn 40",
          demonstrated: true,
        },
      ],
      quickFix: "Do the missing elite behaviour.",
      notDemonstrated: false,
    })),
    ...extras,
  };
}

describe("grade bands", () => {
  const rubric = getKickoffRubric();

  it("maps scores to rubric band names", () => {
    expect(gradeFromScore(100, rubric)).toBe("Elite");
    expect(gradeFromScore(90, rubric)).toBe("Elite");
    expect(gradeFromScore(89, rubric)).toBe("Strong");
    expect(gradeFromScore(80, rubric)).toBe("Strong");
    expect(gradeFromScore(79, rubric)).toBe("Inconsistent");
    expect(gradeFromScore(70, rubric)).toBe("Inconsistent");
    expect(gradeFromScore(69, rubric)).toBe("At risk");
    expect(gradeFromScore(60, rubric)).toBe("At risk");
    expect(gradeFromScore(59, rubric)).toBe("Fail");
    expect(gradeFromScore(0, rubric)).toBe("Fail");
  });
});

describe("dimension bounds", () => {
  it("clamps scores above max and below 0", () => {
    const rubric = getKickoffRubric();
    const over: Record<string, number | null> = {};
    for (const d of rubric.dimensions) over[d.id] = d.maxScore + 20;
    over.d1 = -4;

    const result = applyCapsAndBuildResult({
      model: stubModel(rubric, over),
      rubric,
      modelName: "test",
    });

    for (const dim of result.dimensions) {
      expect(dim.score).not.toBeNull();
      expect(dim.score!).toBeGreaterThanOrEqual(0);
      expect(dim.score!).toBeLessThanOrEqual(dim.maxScore);
    }
  });
});

describe("total score", () => {
  it("sums dimension scores deterministically", () => {
    expect(
      sumDimensionScores([
        { score: 10 },
        { score: 10 },
        { score: 5 },
        { score: null, disabled: true },
      ]),
    ).toBe(25);
  });

  it("calculates kickoff total from dimension scores", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {
      d1: 10,
      d2: 10,
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
    const result = applyCapsAndBuildResult({
      model: stubModel(rubric, scores),
      rubric,
      modelName: "test",
    });
    expect(result.overallScore).toBe(100);
    expect(result.grade).toBe("Elite");
    expect(result.scoreOutOf).toBe(100);
  });

  it("applies total auto-caps", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;

    const result = applyCapsAndBuildResult({
      model: stubModel(rubric, scores, { firedCapIds: ["no-follow-ups"] }),
      rubric,
      modelName: "test",
    });
    expect(result.overallScore).toBe(70);
    expect(result.firedCaps.some((c) => c.id === "no-follow-ups")).toBe(true);
  });

  it("normalizes coaching score when D4 is disabled (out of 85)", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {
      d1: 10,
      d2: 10,
      d3: 15,
      d4: null,
      d5: 10,
      d6: 15,
      d7: 5,
      d8: 5,
      d9: 5,
      d10: 5,
      d11: 5,
      d12: 5,
    };
    const result = applyCapsAndBuildResult({
      model: stubModel(rubric, scores),
      rubric,
      modelName: "test",
    });
    // Table without D4 sums to 90 (source prose says 85 — see README).
    expect(result.scoreOutOf).toBe(90);
    expect(result.overallScore).toBe(100);
    expect(result.dimensions.find((d) => d.id === "d4")?.disabled).toBe(true);
  });

  it("reports projected one-thing score from estimated gain", () => {
    expect(normalizeToHundred(80, 100)).toBe(80);
    expect(normalizeToHundred(85, 85)).toBe(100);
  });
});
