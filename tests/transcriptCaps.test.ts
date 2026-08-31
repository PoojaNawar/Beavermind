import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { kickoffHasPrepElite, nextEliteScore } from "@/lib/scoring/eliteBar";
import { applyKickoffCloseCalibration } from "@/lib/scoring/kickoffClose";
import { applyTranscriptAutoCaps } from "@/lib/scoring/transcriptCaps";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import { applyReportPresentation } from "@/lib/ui/reportPresentation";
import { kickoffPostCallQuickFix } from "@/lib/scoring/dimensionAdjudication";
import type { EvaluationResult } from "@/lib/rubrics/types";

const kickoff02 = readFileSync("transcripts/kickoff-02.txt", "utf8");

describe("transcriptCaps", () => {
  it("records no-north-star on kickoff-02 even when D4 is already at cap", () => {
    const base: EvaluationResult = {
      callType: "kickoff",
      rubricVersion: "kickoff-v1",
      overallScore: 65,
      scoreOutOf: 100,
      grade: "At risk",
      oneThing: {
        recommendation: "Book next call live.",
        impact: "Continuity.",
        scoreIfApplied: null,
        scoreIfAppliedBasis: "",
      },
      brief: "",
      redFlags: [],
      dimensions: getKickoffRubric().dimensions.map((d) => ({
        id: d.id,
        name: d.name,
        score: d.id === "d4" ? 10 : d.id === "d10" ? 0 : 7,
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
    };

    const capped = applyTranscriptAutoCaps(base, kickoff02);
    expect(capped.firedCaps.some((c) => c.id === "no-north-star")).toBe(true);
    expect(capped.dimensions.find((d) => d.id === "d4")?.score).toBe(10);
  });
});

describe("kickoff-02 system calibration", () => {
  it("detects prep elite on Renata/Ivan intake references", () => {
    expect(kickoffHasPrepElite(kickoff02)).toBe(true);
  });

  it("caps kickoff D10 when booking is deferred to assistant", () => {
    expect(nextEliteScore("kickoff", "d10", 3, kickoff02)).toBe(0);
  });

  it("hydrates D12 with verified program-build commitment evidence", () => {
    const stored = applyKickoffCloseCalibration(
      {
        callType: "kickoff",
        rubricVersion: "kickoff-v1",
        overallScore: 65,
        scoreOutOf: 100,
        grade: "At risk",
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
          score: d.id === "d12" ? 2.5 : d.maxScore,
          maxScore: d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "No post-call commitments.",
          evidence: [],
          quickFix: "",
          notDemonstrated: d.id === "d12",
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
          notDemonstratedDimensions: 1,
        },
      },
      kickoff02,
    );
    const d12 = stored.dimensions.find((d) => d.id === "d12")!;
    expect(d12.score).toBeGreaterThanOrEqual(2.5);
    expect(d12.verifiedEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(d12.evidence[0]?.quote).toMatch(/build(?: out)? your (?:actual )?program/i);
  });

  it("raises D1 to elite when transcript proves intake prep on hydrate", () => {
    const raw = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Book live.",
          impact: "Continuity.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d10",
        },
        brief: "Weak booking.",
        redFlags: [],
        firedCapIds: ["no-north-star"],
        notes: "",
        dimensions: getKickoffRubric().dimensions.map((d) => ({
          id: d.id,
          score:
            d.id === "d1"
              ? 7
              : d.id === "d4"
                ? 10
                : d.id === "d10"
                  ? 0
                  : d.id === "d12"
                    ? 2.5
                    : 7,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "x",
          evidence: [],
          quickFix: "",
          notDemonstrated: false,
        })),
      },
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff02,
    }) as EvaluationResult;

    const report = applyReportPresentation(
      hydrateCompletedReport(raw, kickoff02),
    );
    expect(report.firedCaps.some((c) => c.id === "no-north-star")).toBe(true);
    expect(report.dimensions.find((d) => d.id === "d1")?.score).toBe(10);
    const d4 = report.dimensions.find((d) => d.id === "d4")!;
    expect(d4.whyNotFullMarks).toMatch(/North Star/i);
  });

  it("prioritizes live booking One Thing when D10 is zero even with no-north-star cap", () => {
    const raw = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Lock the North Star and a 30-day marker.",
          impact: "North star impact.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d4",
        },
        brief: "Solid preparation and rapport but lacked a live booking for the next call.",
        redFlags: [],
        firedCapIds: ["no-north-star"],
        notes: "",
        dimensions: getKickoffRubric().dimensions.map((d) => ({
          id: d.id,
          score:
            d.id === "d4"
              ? 10
              : d.id === "d10"
                ? 0
                : d.id === "d7"
                  ? 5
                  : 7,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "x",
          evidence: [],
          quickFix: "",
          notDemonstrated: false,
        })),
      },
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff02,
    }) as EvaluationResult;

    const report = applyReportPresentation(
      hydrateCompletedReport(raw, kickoff02),
    );
    expect(report.oneThing.recommendation).toMatch(/book the next call live/i);
    expect(report.brief).not.toMatch(/solid preparation and rapport/i);
  });

  it("uses targeted D12 quick fix when program-build evidence already exists", () => {
    const dim = {
      id: "d12",
      name: "Post-Call Execution",
      score: 2.5,
      maxScore: 5,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale: "Two commitments.",
      evidence: [
        {
          quote:
            "If you can get those uploaded by Friday, that gives me the weekend to build out your actual program, so you'd have it ready to start Monday.",
          speaker: "Ivan Petrov",
          location: null,
          demonstrated: true,
          verificationStatus: "verified" as const,
        },
        {
          quote:
            "I'll build your program over the weekend, you'll be live Monday, and just message me in the app if anything comes up before then.",
          speaker: "Ivan Petrov",
          location: null,
          demonstrated: true,
          verificationStatus: "verified" as const,
        },
      ],
      quickFix: "Specify multiple explicit commitments with precise deadlines.",
      notDemonstrated: false,
      evidenceFound: true,
      verifiedEvidenceCount: 2,
      rejectedEvidenceCount: 0,
      evidenceStrength: "high" as const,
      whyNotFullMarks: null,
    };
    expect(kickoffPostCallQuickFix(dim)).toMatch(/one more in-call post-call commitment/i);
  });
});
