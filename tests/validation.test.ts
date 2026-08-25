import { describe, expect, it } from "vitest";
import { validateModelOutput } from "@/lib/validation/schemas";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { getCoachingRubric } from "@/lib/rubrics/coaching";

function baseDimension(id: string, score: number) {
  return {
    id,
    score,
    disabled: false,
    disabledReason: null as string | null,
    notApplicable: false,
    notApplicableReason: null as string | null,
    band: "Strong",
    rationale: "Quote-first: the coach referenced the client's notes.",
    evidence: [
      {
        quote: "Not demonstrated in transcript",
        speaker: null,
        location: null,
        demonstrated: false,
      },
    ],
    quickFix: "Name the missing behaviour out loud.",
    notDemonstrated: true,
  };
}

function twelve(rubric: ReturnType<typeof getKickoffRubric>, score = 3) {
  return rubric.dimensions.map((d) => baseDimension(d.id, Math.min(score, d.maxScore)));
}

describe("model output validation", () => {
  it("accepts a complete 12-dimension payload with missing evidence", () => {
    const rubric = getKickoffRubric();
    const parsed = validateModelOutput(
      {
        oneThing: {
          recommendation: "Build a North Star.",
          impact: "D4 is the #1 loss dimension.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "Move D4 from 5 to 10",
        },
        brief: "The call covered logistics more than meaning.",
        redFlags: [
          {
            title: "Client cut off",
            explanation: "The client tried to go deeper and was interrupted.",
            evidence: "[Client]: it's kind of turned into this whole —",
          },
        ],
        firedCapIds: [],
        notes: "",
        dimensions: twelve(rubric),
      },
      rubric,
    );
    expect(parsed.dimensions).toHaveLength(12);
    expect(parsed.dimensions[0]!.notDemonstrated).toBe(true);
  });

  it("rejects unknown dimension ids", () => {
    const rubric = getKickoffRubric();
    const dims = twelve(rubric);
    dims[0] = { ...dims[0]!, id: "d99" };
    expect(() =>
      validateModelOutput(
        {
          oneThing: {
            recommendation: "x",
            impact: "y",
            estimatedPointsGained: null,
            scoreIfAppliedBasis: "n/a",
          },
          brief: "brief",
          redFlags: [],
          firedCapIds: [],
          notes: "",
          dimensions: dims,
        },
        rubric,
      ),
    ).toThrow(/Unknown dimension/);
  });

  it("rejects scores above the dimension maximum", () => {
    const rubric = getKickoffRubric();
    const dims = twelve(rubric);
    dims[2] = { ...dims[2]!, score: 99 };
    expect(() =>
      validateModelOutput(
        {
          oneThing: {
            recommendation: "x",
            impact: "y",
            estimatedPointsGained: null,
            scoreIfAppliedBasis: "n/a",
          },
          brief: "brief",
          redFlags: [],
          firedCapIds: [],
          notes: "",
          dimensions: dims,
        },
        rubric,
      ),
    ).toThrow(/outside 0/);
  });

  it("rejects malformed payloads missing required fields", () => {
    const rubric = getKickoffRubric();
    expect(() => validateModelOutput({ dimensions: [] }, rubric)).toThrow();
  });

  it("rejects non-bucket coaching scores", () => {
    const rubric = getCoachingRubric();
    const dims = twelve(rubric, 7);
    dims[0] = { ...dims[0]!, score: 8 };
    expect(() =>
      validateModelOutput(
        {
          oneThing: {
            recommendation: "x",
            impact: "y",
            estimatedPointsGained: null,
            scoreIfAppliedBasis: "n/a",
          },
          brief: "brief",
          redFlags: [],
          firedCapIds: [],
          notes: "",
          dimensions: dims,
        },
        rubric,
      ),
    ).toThrow(/must be one of/);
  });

  it("clears leftover scores on disabled or N/A dimensions instead of failing the run", () => {
    const rubric = getCoachingRubric();
    const dims = rubric.dimensions.map((d) => {
      const score = d.discreteScores?.includes(7)
        ? 7
        : (d.discreteScores?.find((s) => s > 0) ?? Math.min(7, d.maxScore));
      return baseDimension(d.id, score);
    });
    dims[1] = {
      ...dims[1]!,
      notApplicable: true,
      notApplicableReason: "Not a diagnostics week.",
      score: 7,
    };
    const parsed = validateModelOutput(
      {
        oneThing: {
          recommendation: "x",
          impact: "y",
          estimatedPointsGained: null,
          scoreIfAppliedBasis: "n/a",
        },
        brief: "brief",
        redFlags: [],
        firedCapIds: [],
        notes: "",
        dimensions: dims,
      },
      rubric,
    );
    expect(parsed.dimensions[1]!.notApplicable).toBe(true);
    expect(parsed.dimensions[1]!.score).toBeNull();
  });
});
