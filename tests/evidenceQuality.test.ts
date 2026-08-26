import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  classifyEvidenceItem,
  dimensionEvidenceUi,
  evidenceStrengthFromVerifiedCount,
  isVerifiedEvidence,
  summarizeDimensionEvidence,
  summarizeReportEvidence,
  verifyEvidenceItems,
} from "@/lib/transcripts/evidenceQuality";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { Rubric } from "@/lib/rubrics/types";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);

const REAL_QUOTE = "you do not need to repeat all of that for me";
const FABRICATED = "The coach definitely booked a Hawaiian vacation together";

function proposed(quote: string, demonstrated = true) {
  return {
    quote,
    speaker: "Dana Whitlock",
    location: null,
    demonstrated,
  };
}

function stubModel(
  rubric: Rubric,
  scores: Record<string, number | null>,
  evidenceForFirst: ModelEvaluationOutput["dimensions"][number]["evidence"],
): ModelEvaluationOutput {
  return {
    oneThing: {
      recommendation: "Lock the next call live.",
      impact: "Continuity.",
      estimatedPointsGained: 5,
      scoreIfAppliedBasis: "D10",
    },
    brief: "A workable call with one clear miss.",
    redFlags: [],
    firedCapIds: [],
    notes: "",
    dimensions: rubric.dimensions.map((d, i) => ({
      id: d.id,
      score: scores[d.id] ?? 0,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale: "Scored from the rubric bands.",
      evidence: i === 0 ? evidenceForFirst : [],
      quickFix: "Do the missing elite behaviour.",
      notDemonstrated: false,
    })),
  };
}

describe("evidence verification states", () => {
  it("marks a transcript excerpt as verified", () => {
    const item = classifyEvidenceItem(proposed(REAL_QUOTE), kickoff01);
    expect(item.verificationStatus).toBe("verified");
    expect(item.demonstrated).toBe(true);
    expect(item.quote).toBe(REAL_QUOTE);
  });

  it("marks a proposed but unmatched excerpt as unverified and keeps the original quote", () => {
    const item = classifyEvidenceItem(proposed(FABRICATED), kickoff01);
    expect(item.verificationStatus).toBe("unverified");
    expect(item.demonstrated).toBe(false);
    expect(item.quote).toBe(FABRICATED);
  });

  it("marks model-asserted absence as not demonstrated", () => {
    const item = classifyEvidenceItem(
      proposed("Not demonstrated in transcript", false),
      kickoff01,
    );
    expect(item.verificationStatus).toBe("not_demonstrated");
    expect(item.demonstrated).toBe(false);
  });

  it("treats a fabricated quote as unverified, not not-demonstrated", () => {
    const item = classifyEvidenceItem(proposed(FABRICATED), kickoff01);
    expect(item.verificationStatus).toBe("unverified");
    expect(item.verificationStatus).not.toBe("not_demonstrated");
  });

  it("rejects an altered quote that does not appear verbatim", () => {
    const altered = `${REAL_QUOTE} and also we climbed Everest together`;
    const item = classifyEvidenceItem(proposed(altered), kickoff01);
    expect(item.verificationStatus).toBe("unverified");
    expect(item.quote).toBe(altered);
  });
});

describe("evidence counts and strength metadata", () => {
  it("counts found / verified / rejected without treating ND placeholders as found", () => {
    const evidence = verifyEvidenceItems(
      [
        proposed(REAL_QUOTE),
        proposed(FABRICATED),
        proposed("Not demonstrated in transcript", false),
      ],
      kickoff01,
    );
    const summary = summarizeDimensionEvidence(evidence, false);
    expect(summary.verifiedEvidenceCount).toBe(1);
    expect(summary.rejectedEvidenceCount).toBe(1);
    expect(summary.evidenceFound).toBe(true);
    expect(summary.evidenceStrength).toBe("medium");

    const report = summarizeReportEvidence([
      { ...summary, disabled: false, notApplicable: false },
      {
        verifiedEvidenceCount: 0,
        rejectedEvidenceCount: 0,
        notDemonstrated: true,
        disabled: false,
        notApplicable: false,
      },
    ]);
    expect(report.found).toBe(2);
    expect(report.verified).toBe(1);
    expect(report.rejected).toBe(1);
    expect(report.notDemonstratedDimensions).toBe(1);
  });

  it("assigns strength from verified count only", () => {
    expect(evidenceStrengthFromVerifiedCount(0)).toBe("low");
    expect(evidenceStrengthFromVerifiedCount(1)).toBe("medium");
    expect(evidenceStrengthFromVerifiedCount(2)).toBe("high");
    expect(evidenceStrengthFromVerifiedCount(5)).toBe("high");
  });
});

describe("scoring boundary", () => {
  it("does not let evidence strength change the overall score", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;

    const rich = applyCapsAndBuildResult({
      model: stubModel(rubric, scores, [
        {
          quote: REAL_QUOTE,
          speaker: "Dana",
          location: null,
          demonstrated: true,
          verificationStatus: "verified",
        },
        {
          quote: "That's going to be our North Star through this whole thing",
          speaker: "Dana",
          location: null,
          demonstrated: true,
          verificationStatus: "verified",
        },
      ]),
      rubric,
      modelName: "test",
    });
    const thin = applyCapsAndBuildResult({
      model: stubModel(rubric, scores, []),
      rubric,
      modelName: "test",
    });

    expect(rich.overallScore).toBe(thin.overallScore);
    expect(rich.grade).toBe(thin.grade);
    expect(rich.dimensions[0]!.score).toBe(thin.dimensions[0]!.score);
    expect(rich.dimensions[0]!.evidenceStrength).toBe("high");
    expect(thin.dimensions[0]!.evidenceStrength).toBe("low");
  });

  it("keeps the model dimension score when a quote is rejected", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = 3;
    scores.d1 = 7;

    const result = applyCapsAndBuildResult({
      model: stubModel(rubric, scores, [
        {
          quote: FABRICATED,
          speaker: "Dana",
          location: null,
          demonstrated: false,
          verificationStatus: "unverified",
        },
      ]),
      rubric,
      modelName: "test",
    });

    expect(result.dimensions[0]!.score).toBe(7);
    expect(result.dimensions[0]!.notDemonstrated).toBe(false);
    expect(result.grade).toBeDefined();
  });

  it("does not present a rejected quote as verified", () => {
    const items = verifyEvidenceItems([proposed(FABRICATED)], kickoff01);
    expect(items.filter(isVerifiedEvidence)).toHaveLength(0);
    expect(items[0]!.demonstrated).toBe(false);
    expect(items[0]!.verificationStatus).toBe("unverified");
  });
});

describe("report evidence states", () => {
  it("all verified → VERIFIED", () => {
    const ui = dimensionEvidenceUi({
      notDemonstrated: false,
      verifiedEvidenceCount: 2,
      rejectedEvidenceCount: 0,
    });
    expect(ui.state).toBe("verified");
    expect(ui.tone).toBe("success");
    expect(ui.label).toBe("Verified");
  });

  it("verified + unverified → PARTIALLY VERIFIED", () => {
    const ui = dimensionEvidenceUi({
      notDemonstrated: false,
      verifiedEvidenceCount: 1,
      rejectedEvidenceCount: 1,
    });
    expect(ui.state).toBe("partially_verified");
    expect(ui.tone).toBe("caution");
    expect(ui.tone).not.toBe("success");
    expect(ui.label).toBe("Partially verified");
  });

  it("all unverified → UNVERIFIED", () => {
    const ui = dimensionEvidenceUi({
      notDemonstrated: false,
      verifiedEvidenceCount: 0,
      rejectedEvidenceCount: 1,
    });
    expect(ui.state).toBe("unverified");
    expect(ui.tone).toBe("warning");
    expect(ui.label).toMatch(/Unverified/i);
    expect(ui.explanation).toMatch(/could not be verified/);
  });

  it("not demonstrated → NOT DEMONSTRATED", () => {
    const ui = dimensionEvidenceUi({
      notDemonstrated: true,
      verifiedEvidenceCount: 0,
      rejectedEvidenceCount: 0,
    });
    expect(ui.state).toBe("not_demonstrated");
    expect(ui.tone).not.toBe("success");
    expect(ui.label).toBe("Not demonstrated");
  });

  it("N/A dimensions are labeled not applicable, not disabled", () => {
    const ui = dimensionEvidenceUi({
      notDemonstrated: false,
      verifiedEvidenceCount: 0,
      rejectedEvidenceCount: 0,
      notApplicable: true,
    });
    expect(ui.label).toBe("Not applicable");
    expect(ui.explanation).toMatch(/did not occur|did not apply/i);

    const disabled = dimensionEvidenceUi({
      notDemonstrated: false,
      verifiedEvidenceCount: 0,
      rejectedEvidenceCount: 0,
      disabled: true,
    });
    expect(disabled.label).toBe("Not applicable");
    expect(disabled.label).not.toBe("Disabled");
  });
});
