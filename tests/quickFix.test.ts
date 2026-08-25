import { describe, expect, it } from "vitest";
import {
  resolveQuickFix,
  refreshDimensionQuickFixes,
} from "@/lib/scoring/quickFix";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { DimensionResult } from "@/lib/rubrics/types";

function emptyQuality(): Pick<
  DimensionResult,
  | "evidenceFound"
  | "verifiedEvidenceCount"
  | "rejectedEvidenceCount"
  | "evidenceStrength"
> {
  return {
    evidenceFound: false,
    verifiedEvidenceCount: 0,
    rejectedEvidenceCount: 0,
    evidenceStrength: "low",
  };
}

describe("resolveQuickFix", () => {
  const rubric = getKickoffRubric();
  const rapport = rubric.dimensions.find((d) => d.id === "d2")!;
  const prep = rubric.dimensions.find((d) => d.id === "d1")!;

  it("keeps a model-written quick fix", () => {
    expect(
      resolveQuickFix({
        quickFix: "Share one relevant personal beat, then pause.",
        score: 7,
        maxScore: 10,
        disabled: false,
        notApplicable: false,
        dimension: rapport,
      }),
    ).toBe("Share one relevant personal beat, then pause.");
  });

  it("fills an empty rapport quick fix from the elite action without changing the score", () => {
    const text = resolveQuickFix({
      quickFix: "   ",
      score: 7,
      maxScore: 10,
      disabled: false,
      notApplicable: false,
      dimension: rapport,
    });
    expect(text).toMatch(/personal/i);
    expect(text).not.toMatch(/full marks were reached/i);
  });

  it("keeps the existing full-marks sentence", () => {
    expect(
      resolveQuickFix({
        quickFix: "Full marks were reached.",
        score: 10,
        maxScore: 10,
        disabled: false,
        notApplicable: false,
        dimension: rapport,
      }),
    ).toBe("Full marks were reached.");
  });

  it("does not keep a canned full-marks line on a missed dimension", () => {
    const text = resolveQuickFix({
      quickFix: "Full marks were reached.",
      score: 7,
      maxScore: 10,
      disabled: false,
      notApplicable: false,
      dimension: rapport,
    });
    expect(text).toMatch(/personal/i);
  });

  it("replaces rubric-criteria dumps that look invalid on the report", () => {
    const text = resolveQuickFix({
      quickFix:
        "To reach 10/10: Fully reviewed intake; specific goals+name+injuries early; ≥2 CRM details.",
      score: 7,
      maxScore: 10,
      disabled: false,
      notApplicable: false,
      dimension: prep,
    });
    expect(text).toMatch(/intake details/i);
    expect(text).not.toMatch(/≥2/);
  });
});

describe("refreshDimensionQuickFixes", () => {
  it("splits the same canned sentence across missed dimensions", () => {
    const rubric = getKickoffRubric();
    const dims = rubric.dimensions.map((d, i) => {
      const maxed = i !== 1 && i !== 3;
      return {
        id: d.id,
        name: d.name,
        score: maxed ? d.maxScore : Math.max(0, d.maxScore - 3),
        maxScore: d.maxScore,
        disabled: false,
        disabledReason: null,
        notApplicable: false,
        notApplicableReason: null,
        band: null,
        rationale: "Scored from the rubric bands.",
        evidence: [],
        quickFix: "Do the missing elite behaviour.",
        notDemonstrated: false,
        ...emptyQuality(),
      } satisfies DimensionResult;
    });

    const refreshed = refreshDimensionQuickFixes(dims, rubric);
    const below = refreshed.filter((d) => (d.score ?? 0) < d.maxScore);
    expect(below).toHaveLength(2);
    expect(below[0]!.quickFix).not.toBe(below[1]!.quickFix);
    expect(below.every((d) => d.quickFix.length > 12)).toBe(true);
    expect(refreshed.filter((d) => d.score === d.maxScore).every((d) => d.quickFix === "Full marks were reached.")).toBe(
      true,
    );
  });
});

describe("empty model quickFix does not change kickoff totals", () => {
  it("still scores rapport 7/10 when the model omitted the quick fix", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {
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
    const model: ModelEvaluationOutput = {
      oneThing: {
        recommendation: "Deepen rapport with one relevant personal share.",
        impact: "Client opens up.",
        estimatedPointsGained: 3,
        scoreIfAppliedBasis: "D2 from 7 to 10",
      },
      brief: "Strong kick-off; rapport stayed surface.",
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
        rationale: "Scored from the rubric bands.",
        evidence: [],
        quickFix: "",
        notDemonstrated: false,
      })),
    };

    const result = applyCapsAndBuildResult({
      model,
      rubric,
      modelName: "test",
    });
    const d2 = result.dimensions.find((d) => d.id === "d2")!;
    const d3 = result.dimensions.find((d) => d.id === "d3")!;
    expect(d2.score).toBe(7);
    expect(d2.quickFix).toMatch(/personal/i);
    expect(d3.quickFix).toBe("Full marks were reached.");
    expect(result.overallScore).toBe(96);
  });
});
