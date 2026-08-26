import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import {
  coachingPillars,
  computeScoreIfApplied,
  oneThingLiftTargets,
  resolveLeverageTheme,
} from "@/lib/scoring/scoreIfApplied";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

function coachingModel(
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput> & {
    na?: string[];
    disabled?: string[];
  },
): ModelEvaluationOutput {
  const rubric = getCoachingRubric();
  const na = new Set(extras?.na ?? []);
  const disabled = new Set(extras?.disabled ?? []);
  return {
    oneThing: extras?.oneThing ?? {
      recommendation: "Encourage community posting.",
      impact: "This will improve the coaching experience.",
      estimatedPointsGained: 99,
      scoreIfAppliedBasis: "model guess",
    },
    brief: "Mixed call.",
    redFlags: [],
    firedCapIds: extras?.firedCapIds ?? [],
    notes: "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: na.has(d.id) || disabled.has(d.id) ? null : (scores[d.id] ?? d.maxScore),
      disabled: disabled.has(d.id),
      disabledReason: disabled.has(d.id) ? "No movement coaching." : null,
      notApplicable: na.has(d.id),
      notApplicableReason: na.has(d.id)
        ? "Diagnostics review did not occur in this cycle."
        : null,
      band: null,
      rationale: "Scored from transcript evidence.",
      evidence: [],
      quickFix: "",
      notDemonstrated: false,
    })),
  };
}

describe("coaching pillars", () => {
  it("summarizes Connection, Confidence, and Continuity with the weakest drag", () => {
    const rubric = getCoachingRubric();
    const result = applyCapsAndBuildResult({
      model: coachingModel(
        {
          d1: 10,
          d2: null,
          d3: 10,
          d4: null,
          d5: 7,
          d6: 10,
          d7: 3,
          d8: 5,
          d9: 5,
          d10: 0,
          d11: 3,
          d12: 5,
        },
        {
          na: ["d2"],
          disabled: ["d4"],
          firedCapIds: ["next-call-not-booked", "no-long-term-vision"],
        },
      ),
      rubric,
      modelName: "test",
    });

    const pillars = coachingPillars(result);
    expect(pillars.map((p) => p.name)).toEqual([
      "Connection",
      "Confidence",
      "Continuity",
    ]);
    const continuity = pillars.find((p) => p.id === "continuity")!;
    expect(continuity.dragged).toBe(true);
    expect(continuity.weakest?.name).toMatch(/Next Call Booking/i);
    expect(pillars.every((p) => p.available > 0)).toBe(true);
  });
});

describe("backend score-if-applied", () => {
  it("ignores the model point-gain guess and projects from lifted dimensions", () => {
    const rubric = getCoachingRubric();
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: coachingModel(
          {
            d1: 10,
            d2: null,
            d3: 10,
            d4: null,
            d5: 7,
            d6: 10,
            d7: 3,
            d8: 5,
            d9: 5,
            d10: 0,
            d11: 3,
            d12: 5,
          },
          {
            na: ["d2"],
            disabled: ["d4"],
            firedCapIds: ["next-call-not-booked", "no-long-term-vision"],
          },
        ),
        rubric,
        modelName: "test",
      }),
    );

    expect(resolveLeverageTheme(result)).toBe("accountability-loop");
    const lifts = oneThingLiftTargets(result);
    expect([...lifts.keys()].sort()).toEqual(["d10", "d11", "d6", "d7"]);

    const projection = computeScoreIfApplied(result);
    expect(projection.scoreIfApplied).not.toBeNull();
    expect(projection.scoreIfApplied!).toBeGreaterThan(result.overallScore);
    expect(projection.scoreIfAppliedBasis).not.toMatch(/model guess|d10|99/i);
    expect(projection.scoreIfAppliedBasis).toMatch(/full marks/i);

    expect(result.oneThing.scoreIfApplied).toBe(projection.scoreIfApplied);
    // Model asked for +99; backend must not honor that.
    expect(result.oneThing.scoreIfApplied).toBeLessThan(100);
  });

  it("returns null when every scored dimension is already full marks", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = applyCapsAndBuildResult({
      model: coachingModel(scores),
      rubric,
      modelName: "test",
    });
    const projection = computeScoreIfApplied(result);
    expect(projection.scoreIfApplied).toBeNull();
    expect(projection.scoreIfAppliedBasis).toMatch(/full marks/i);
  });
});
