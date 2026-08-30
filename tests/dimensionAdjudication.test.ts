import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  computeWhyNotFullMarks,
  finalizeDimensionAdjudication,
  isBrokenEvidenceQuote,
  performanceLevel,
  performanceLevelLabel,
  sanitizeDimensionEvidence,
} from "@/lib/scoring/dimensionAdjudication";
import { applyKickoffCloseCalibration } from "@/lib/scoring/kickoffClose";
import { kickoffHasPrepElite } from "@/lib/scoring/eliteBar";
import { applyReportPresentation, whyNotFullMarksCopy } from "@/lib/ui/reportPresentation";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { DimensionResult, EvaluationResult } from "@/lib/rubrics/types";

const kickoff01 = readFileSync("transcripts/kickoff-01.txt", "utf8");

function dim(partial: Partial<DimensionResult> & Pick<DimensionResult, "id">): DimensionResult {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    score: partial.score ?? 10,
    maxScore: partial.maxScore ?? 10,
    disabled: partial.disabled ?? false,
    disabledReason: partial.disabledReason ?? null,
    notApplicable: partial.notApplicable ?? false,
    notApplicableReason: partial.notApplicableReason ?? null,
    band: partial.band ?? null,
    rationale: partial.rationale ?? "Strong work.",
    evidence: partial.evidence ?? [],
    quickFix: partial.quickFix ?? "",
    notDemonstrated: partial.notDemonstrated ?? false,
    evidenceFound: partial.evidenceFound ?? true,
    verifiedEvidenceCount: partial.verifiedEvidenceCount ?? 1,
    rejectedEvidenceCount: partial.rejectedEvidenceCount ?? 0,
    evidenceStrength: partial.evidenceStrength ?? "high",
    whyNotFullMarks: partial.whyNotFullMarks ?? null,
  };
}

describe("dimensionAdjudication", () => {
  it("detects broken clipped evidence quotes", () => {
    expect(isBrokenEvidenceQuote("re we actually go — I'm assigning")).toBe(true);
    expect(
      isBrokenEvidenceQuote(
        "I'm assigning your diagnostics inside the training app right now.",
      ),
    ).toBe(false);
  });

  it("sets whyNotFullMarks for partial scores only", () => {
    const partial = finalizeDimensionAdjudication(
      dim({ id: "d1", score: 9, maxScore: 10 }),
      "kickoff",
    );
    expect(partial.whyNotFullMarks).toMatch(/rubric requires/i);
    expect(partial.quickFix).toMatch(/intake details/i);

    const full = finalizeDimensionAdjudication(
      dim({ id: "d1", score: 10, maxScore: 10 }),
      "kickoff",
    );
    expect(full.whyNotFullMarks).toBeNull();
    expect(full.quickFix).toBe("Full marks reached.");
  });

  it("labels 9/10 as minor opportunity", () => {
    const d = dim({ id: "d1", score: 9, maxScore: 10 });
    expect(performanceLevel(d)).toBe("minor_opportunity");
    expect(performanceLevelLabel(performanceLevel(d))).toBe("MINOR OPPORTUNITY");
  });

  it("removes broken quotes during sanitization", () => {
    const cleaned = sanitizeDimensionEvidence(
      dim({
        id: "d12",
        evidence: [
          {
            quote: "re we actually go — I'm assigning your diagnostics",
            speaker: null,
            location: null,
            demonstrated: true,
            verificationStatus: "verified",
          },
          {
            quote: "I'm assigning your diagnostics inside the training app right now.",
            speaker: "Dana",
            location: null,
            demonstrated: true,
            verificationStatus: "verified",
          },
        ],
        verifiedEvidenceCount: 2,
      }),
    );
    expect(cleaned.evidence).toHaveLength(1);
    expect(cleaned.verifiedEvidenceCount).toBe(1);
  });

  it("whyNotFullMarks cites rubric criteria without vague coaching language", () => {
    const partial = finalizeDimensionAdjudication(
      dim({ id: "d1", score: 9, maxScore: 10 }),
      "kickoff",
    );
    expect(partial.whyNotFullMarks).toMatch(/rubric requires/i);
    expect(partial.whyNotFullMarks).not.toMatch(/surface|could have|stronger|deepen/i);
  });
});

describe("kickoff-01 regression", () => {
  it("passes prep elite detector on Owen/Dana transcript", () => {
    expect(kickoffHasPrepElite(kickoff01)).toBe(true);
  });

  it("hydrates to 100/100 with no whyNotFullMarks gaps", () => {
    const scores: Record<string, number | null> = {};
    for (const d of getKickoffRubric().dimensions) {
      scores[d.id] = d.id === "d1" ? 9 : d.maxScore;
    }
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Strengthen program explanation.",
          impact: "Improve client understanding.",
          estimatedPointsGained: 1,
          scoreIfAppliedBasis: "d5",
        },
        brief: "Strong call.",
        redFlags: [],
        firedCapIds: [],
        notes: "",
        dimensions: getKickoffRubric().dimensions.map((d) => ({
          id: d.id,
          score: scores[d.id] ?? d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale:
            d.id === "d1"
              ? "Dana demonstrated thorough preparation by referencing specific intake details."
              : "Strong dimension.",
          evidence: [],
          quickFix: d.id === "d1" ? "Surface preparation early." : "",
          notDemonstrated: false,
        })),
      },
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    }) as EvaluationResult;

    const report = applyReportPresentation(
      hydrateCompletedReport(base, kickoff01),
    );
    const d1 = report.dimensions.find((d) => d.id === "d1")!;
    expect(d1.score).toBe(10);
    expect(whyNotFullMarksCopy(d1)).toBeNull();
    expect(report.overallScore).toBeGreaterThanOrEqual(100);

    const d12 = report.dimensions.find((d) => d.id === "d12")!;
    for (const ev of d12.evidence) {
      expect(isBrokenEvidenceQuote(ev.quote)).toBe(false);
    }
  });

  it("post-call quotes start cleanly from Dana commitments", () => {
    const result = applyKickoffCloseCalibration(
      {
        callType: "kickoff",
        rubricVersion: "kickoff-v1",
        overallScore: 95,
        scoreOutOf: 100,
        grade: "Elite",
        oneThing: {
          recommendation: "x",
          impact: "y",
          scoreIfApplied: null,
          scoreIfAppliedBasis: "",
        },
        brief: "",
        redFlags: [],
        dimensions: getKickoffRubric().dimensions.map((d) => ({
          id: d.id,
          name: d.name,
          score: d.id === "d12" ? 3 : d.maxScore,
          maxScore: d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "x",
          evidence: [],
          quickFix: "",
          notDemonstrated: false,
          evidenceFound: false,
          verifiedEvidenceCount: 0,
          rejectedEvidenceCount: 0,
          evidenceStrength: "none" as const,
        })),
        firedCaps: [],
        modelName: "test",
        evidenceQuality: {
          found: 0,
          verified: 0,
          rejected: 0,
          notDemonstratedDimensions: 0,
        },
      },
      kickoff01,
    );
    const d12 = result.dimensions.find((d) => d.id === "d12")!;
    expect(d12.score).toBe(5);
    expect(d12.evidence.length).toBeGreaterThanOrEqual(3);
    expect(d12.evidence[0]!.quote).toMatch(/^I(?:'m| am) assigning your diagnostics/i);
    expect(d12.evidence[0]!.speaker).toMatch(/Dana/i);
    expect(d12.rationale).toMatch(/three/i);
  });
});
