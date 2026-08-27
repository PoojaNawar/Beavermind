import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { isIncompleteQuickFix, resolveQuickFix } from "@/lib/scoring/quickFix";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";
import {
  briefSections,
  dimensionImpact,
  dimensionOverview,
  dimensionStatusLabel,
  hideInternalIds,
  refineOneThing,
  scoreHeadline,
  scoringNotes,
} from "@/lib/ui/reportPresentation";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { Rubric } from "@/lib/rubrics/types";

function modelFor(
  rubric: Rubric,
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput> & {
    na?: string[];
    disabled?: string[];
  },
): ModelEvaluationOutput {
  const na = new Set(extras?.na ?? []);
  const disabled = new Set(extras?.disabled ?? []);
  return {
    oneThing: extras?.oneThing ?? {
      recommendation: "Encourage the client to share more in the community.",
      impact: "This will improve the coaching experience.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "d6",
    },
    brief: extras?.brief ?? "A call with mixed execution.",
    redFlags: extras?.redFlags ?? [],
    firedCapIds: extras?.firedCapIds ?? [],
    notes: extras?.notes ?? "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: na.has(d.id) || disabled.has(d.id) ? null : (scores[d.id] ?? d.maxScore),
      disabled: disabled.has(d.id),
      disabledReason: disabled.has(d.id) ? "No movement coaching on this call." : null,
      notApplicable: na.has(d.id),
      notApplicableReason: na.has(d.id)
        ? "Diagnostics review did not occur in this cycle, so this dimension was not scored."
        : null,
      band: null,
      rationale: extras?.dimensions?.find((x) => x.id === d.id)?.rationale
        ?? `The coach covered ${d.name} from the transcript.`,
      evidence: extras?.dimensions?.find((x) => x.id === d.id)?.evidence ?? [
        {
          quote: "Let's keep going with the plan.",
          speaker: "Coach",
          location: null,
          demonstrated: true,
          verificationStatus: "verified" as const,
        },
      ],
      quickFix: extras?.dimensions?.find((x) => x.id === d.id)?.quickFix ?? "",
      notDemonstrated: extras?.dimensions?.find((x) => x.id === d.id)?.notDemonstrated ?? false,
    })),
  };
}

describe("incomplete Quick Fix rejection", () => {
  it("rejects truncated and malformed recommendations", () => {
    expect(
      isIncompleteQuickFix(
        "Leave with coach and client commitments that have owners and",
      ),
    ).toBe(true);
    expect(
      isIncompleteQuickFix("Restate the anchor and name the coach follow-up with a"),
    ).toBe(true);
    expect(isIncompleteQuickFix("Confirm the diagnostic !' film !' upload")).toBe(
      true,
    );
    expect(isIncompleteQuickFix("Name two intake details (goals")).toBe(true);
    expect(
      isIncompleteQuickFix(
        "Give the client one clear deliverable, assign an owner and deadline, and confirm what happens if the commitment is missed.",
      ),
    ).toBe(false);
  });

  it("replaces truncated model output with a complete fallback", () => {
    const rubric = getCoachingRubric();
    const d6 = rubric.dimensions.find((d) => d.id === "d6")!;
    const text = resolveQuickFix({
      quickFix: "Leave with coach and client commitments that have owners and",
      score: 10,
      maxScore: 15,
      disabled: false,
      notApplicable: false,
      dimension: d6,
    });
    expect(text).not.toMatch(/owners and$/i);
    expect(text.endsWith(".")).toBe(true);
    expect(text.toLowerCase()).toMatch(/deadline|owner/);
  });
});

describe("evaluation presentation quality cases", () => {
  it("1. high-scoring kick-off keeps full-mark feedback and does not invent a fake gap", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, {
          oneThing: {
            recommendation: "Share more in the community.",
            impact: "This will improve the coaching experience.",
            estimatedPointsGained: null,
            scoreIfAppliedBasis: "already full marks",
          },
        }),
        rubric,
        modelName: "test",
      }),
    );
    expect(result.overallScore).toBe(100);
    expect(result.oneThing.recommendation).toMatch(/keep this standard/i);
    expect(result.oneThing.recommendation).not.toMatch(/\bd\d+\b/i);
    expect(result.dimensions.every((d) => presentQuickFix(d, "kickoff")?.complete)).toBe(
      true,
    );
  });

  it("2. lower-scoring kick-off One Thing follows the largest meaningful gap", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d4 = 10;
    scores.d2 = 7;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, { firedCapIds: ["no-north-star"] }),
        rubric,
        modelName: "test",
      }),
    );
    expect(result.overallScore).toBeLessThan(100);
    expect(result.oneThing.recommendation).toMatch(/north star/i);
    expect(result.oneThing.impact).not.toMatch(/improve the coaching experience/i);
    expect(scoringNotes(result).join(" ")).not.toMatch(/\bd4\b/i);
  });

  it("3. strong coaching call keeps high scores and specific next action", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d5 = 7;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, {
          oneThing: {
            recommendation: "Frame the adjustment as strategy.",
            impact: "Protects the long game.",
            estimatedPointsGained: 3,
            scoreIfAppliedBasis: "d5",
          },
        }),
        rubric,
        modelName: "test",
      }),
    );
    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.oneThing.recommendation).not.toMatch(/\bd5\b/i);
    const d5 = result.dimensions.find((d) => d.id === "d5")!;
    expect(presentQuickFix(d5, "coaching")?.title).toMatch(/adjustment/i);
  });

  it("4. lower-scoring coaching call prefers live booking and accountability over community posting", () => {
    const rubric = getCoachingRubric();
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(
          rubric,
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

    expect(result.scoreOutOf).toBe(80);
    expect(result.overallScore).toBe(73);
    expect(result.oneThing.recommendation).toMatch(/accountability|continuity|next call/i);
    expect(result.oneThing.recommendation).not.toMatch(/community/i);
    expect(result.oneThing.recommendation).not.toMatch(/\bd10\b|\bd3\b/i);
    expect(scoreHeadline(result)).toMatch(/booking|accountability|continuity/i);
    expect(briefSections(result).held).toMatch(/booking|accountability|continuity|vision/i);

    const notes = scoringNotes(result).join(" ");
    expect(notes).toMatch(/not applicable/i);
    expect(notes).toMatch(/not booked live/i);
    expect(notes).not.toMatch(/\bd10\b|\bd3\b/i);

    const d10 = result.dimensions.find((d) => d.id === "d10")!;
    expect(dimensionImpact(d10, result)).toBe("critical");
    expect(dimensionStatusLabel(d10, result)).toBe("CRITICAL");
    const d7 = result.dimensions.find((d) => d.id === "d7")!;
    expect(dimensionImpact(d7, result)).toBe("high");
    expect(dimensionStatusLabel(d7, result)).toBe("OPPORTUNITY");
    const d5 = result.dimensions.find((d) => d.id === "d5")!;
    expect(dimensionImpact(d5, result)).toBe("opportunity");
    expect(dimensionStatusLabel(d5, result)).toBe("OPPORTUNITY");

    const overview = dimensionOverview(result);
    expect(overview.summary).toMatch(/strong/);
    expect(overview.critical).toBeGreaterThan(0);
    expect(overview.total).toBe(result.dimensions.length);
  });

  it("5. N/A dimensions do not penalize the score or look like the coach turned them off", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, { na: ["d2"], disabled: ["d4"] }),
        rubric,
        modelName: "test",
      }),
    );
    expect(result.overallScore).toBe(100);
    expect(result.scoreOutOf).toBe(80);
    const notes = scoringNotes(result).join(" ");
    expect(notes).toMatch(/2 dimensions were not applicable/i);
    expect(notes).not.toMatch(/turned off|disabled/i);
    const d2 = result.dimensions.find((d) => d.id === "d2")!;
    expect(d2.notApplicable).toBe(true);
    expect(presentQuickFix(d2, "coaching")).toBeNull();
  });

  it("6. unverified proposed evidence cannot keep Elite and is not treated as fact", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d3 = 15;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, {
          firedCapIds: ["no-long-term-vision"],
          dimensions: [
            {
              id: "d3",
              score: 15,
              disabled: false,
              disabledReason: null,
              notApplicable: false,
              notApplicableReason: null,
              band: null,
              rationale: "The client clearly stated their 12-month vision.",
              evidence: [
                {
                  quote: "I will be competing at CrossFit Games by December.",
                  speaker: "Client",
                  location: null,
                  demonstrated: true,
                  verificationStatus: "unverified",
                },
              ],
              quickFix: "The client clearly stated their 12-month vision.",
              notDemonstrated: false,
            },
          ],
        }),
        rubric,
        modelName: "test",
      }),
    );
    const d3 = result.dimensions.find((d) => d.id === "d3")!;
    expect(d3.score).toBeLessThan(15);
    expect(d3.rejectedEvidenceCount).toBe(1);
    expect(d3.verifiedEvidenceCount).toBe(0);
    const view = presentQuickFix(d3, "coaching");
    expect(view?.body).toMatch(/does not provide sufficient verified evidence/i);
    expect(view?.body).not.toMatch(/the client clearly stated/i);
  });

  it("7. rejected evidence stays rejected and does not change the score", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = 7;
    const result = applyCapsAndBuildResult({
      model: modelFor(rubric, scores, {
        dimensions: [
          {
            id: "d1",
            score: 7,
            disabled: false,
            disabledReason: null,
            notApplicable: false,
            notApplicableReason: null,
            band: null,
            rationale: "Prep was visible but incomplete.",
            evidence: [
              {
                quote: "The coach booked a Hawaiian vacation together",
                speaker: "Dana",
                location: null,
                demonstrated: true,
                verificationStatus: "unverified",
              },
            ],
            quickFix: "Name two intake details in the first minutes.",
            notDemonstrated: false,
          },
        ],
      }),
      rubric,
      modelName: "test",
    });
    expect(result.dimensions[0]!.score).toBe(7);
    expect(result.dimensions[0]!.rejectedEvidenceCount).toBe(1);
    expect(result.dimensions[0]!.evidence[0]!.verificationStatus).toBe("unverified");
  });

  it("8. missing a critical requirement is labeled critical and becomes the One Thing", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d10 = 0;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores, { firedCapIds: ["next-call-not-booked"] }),
        rubric,
        modelName: "test",
      }),
    );
    const d10 = result.dimensions.find((d) => d.id === "d10")!;
    expect(d10.score).toBe(0);
    expect(dimensionImpact(d10, result)).toBe("critical");
    expect(result.oneThing.recommendation).toMatch(/book the next call/i);
    expect(presentQuickFix(d10, "coaching")?.title).toMatch(/book the next call/i);
  });

  it("9. all full marks produces no improvement Quick Fixes", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = hydrateEvaluationResult(
      applyCapsAndBuildResult({
        model: modelFor(rubric, scores),
        rubric,
        modelName: "test",
      }),
    );
    expect(result.overallScore).toBe(100);
    for (const dim of result.dimensions) {
      const view = presentQuickFix(dim, "coaching");
      expect(view?.complete).toBe(true);
      expect(view?.title).toMatch(/full marks/i);
    }
    expect(refineOneThing(result).recommendation).toMatch(/keep this standard/i);
    expect(scoreHeadline(result)).toMatch(/full marks/i);
  });
});

describe("internal IDs stay out of coach-facing copy", () => {
  it("strips dimension IDs from scoring language", () => {
    expect(hideInternalIds("Capped: d10 forced to 0; d3 capped at 10")).not.toMatch(
      /\bd\d+\b/i,
    );
  });
});
