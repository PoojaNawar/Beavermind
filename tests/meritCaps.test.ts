import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import {
  detectInterruptedDisclosureRedFlags,
  kickoffHasUnexploredDisclosure,
  mergeKickoffDisclosureRedFlags,
} from "@/lib/scoring/kickoffClose";
import {
  kickoffBookingMeritScore,
  kickoffDeepWhyMeritScore,
  scoreFitsRubricBand,
} from "@/lib/scoring/meritCaps";
import { isLeakedReasoningQuickFix } from "@/lib/scoring/quickFix";
import { validateModelScoring } from "@/lib/scoring/validateModelScoring";
import { applyReportPresentation } from "@/lib/ui/reportPresentation";
import type { EvaluationResult } from "@/lib/rubrics/types";

const kickoff02 = readFileSync("transcripts/kickoff-02.txt", "utf8");
const kickoff01 = readFileSync("transcripts/kickoff-01.txt", "utf8");

describe("merit-first kickoff scoring", () => {
  it("scores kickoff-02 D4 at Mid merit (5/15) before cap", () => {
    expect(kickoffDeepWhyMeritScore(kickoff02)).toBe(5);
  });

  it("scores kickoff-02 D10 in Mid band when booking is deferred", () => {
    expect(kickoffBookingMeritScore(kickoff02)).toBe(3);
  });

  it("hydrates kickoff-02 model output to D4=5 and D10=3 with cap notes", () => {
    const raw = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Lock North Star.",
          impact: "Alignment.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d4",
        },
        brief: "Weak booking.",
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
                : d.id === "d1"
                  ? 10
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
          quickFix:
            d.id === "d11"
              ? "The recap is already in the transcript. Do not treat this as a missing recap."
              : "",
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
    const d4 = report.dimensions.find((d) => d.id === "d4")!;
    const d10 = report.dimensions.find((d) => d.id === "d10")!;
    const d11 = report.dimensions.find((d) => d.id === "d11")!;

    expect(d4.score).toBe(5);
    expect(d4.meritScore).toBe(5);
    expect(d4.capNote).toMatch(/did not apply/i);
    expect(d10.score).toBe(3);
    expect(d10.meritScore).toBe(3);
    expect(d11.quickFix).not.toMatch(/do not treat/i);
    expect(report.redFlags.some((f) => /unexplored client disclosure/i.test(f.title))).toBe(
      true,
    );
    const d7 = report.dimensions.find((d) => d.id === "d7")!;
    expect(d7.score).toBe(3);
  });

  it("does not regress kickoff-01 D4 elite merit", () => {
    expect(kickoffDeepWhyMeritScore(kickoff01)).toBe(15);
  });

  it("detects unexplored disclosure on kickoff-02", () => {
    const disclosure = kickoffHasUnexploredDisclosure(kickoff02);
    expect(disclosure.fired).toBe(true);
    expect(disclosure.quotes.length).toBeGreaterThanOrEqual(2);
    expect(disclosure.quotes.join(" ")).toMatch(/turned into this whole/i);
    expect(disclosure.quotes.join(" ")).toMatch(/lot going on where I just kind of lose/i);
  });

  it("merges disclosure flags into stored results", () => {
    const base: EvaluationResult = {
      callType: "kickoff",
      rubricVersion: "kickoff-v1",
      overallScore: 67,
      scoreOutOf: 100,
      grade: "At risk",
      oneThing: {
        recommendation: "Book live.",
        impact: "Continuity.",
        scoreIfApplied: null,
        scoreIfAppliedBasis: "",
      },
      brief: "",
      redFlags: [],
      dimensions: [],
      firedCaps: [],
      modelName: "test",
      evidenceQuality: {
        found: 0,
        verified: 0,
        rejected: 0,
        notDemonstratedDimensions: 0,
      },
    };
    const merged = mergeKickoffDisclosureRedFlags(base, kickoff02);
    expect(merged.redFlags.length).toBe(1);
  });

  it("rejects leaked quick-fix copy in validation", () => {
    expect(
      isLeakedReasoningQuickFix(
        "If the score is below 5, the remaining gap is confidence.",
      ),
    ).toBe(true);
  });

  it("flags model D4=10 with no-north-star when merit is Mid", () => {
    const errors = validateModelScoring({
      rubric: getKickoffRubric(),
      transcript: kickoff02,
      model: {
        oneThing: {
          recommendation: "x",
          impact: "y",
          estimatedPointsGained: null,
          scoreIfAppliedBasis: "",
        },
        brief: "",
        redFlags: [],
        firedCapIds: ["no-north-star"],
        notes: "",
        dimensions: getKickoffRubric().dimensions.map((d) => ({
          id: d.id,
          score: d.id === "d4" ? 10 : d.id === "d10" ? 0 : 7,
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
    });
    expect(errors.some((e) => e.includes("d4"))).toBe(true);
    expect(errors.some((e) => e.includes("d10"))).toBe(true);
  });

  it("validates scores against rubric bands", () => {
    const d10 = getKickoffRubric().dimensions.find((d) => d.id === "d10")!;
    expect(scoreFitsRubricBand(3, d10, "kickoff")).toBe(true);
    expect(scoreFitsRubricBand(0, d10, "kickoff")).toBe(true);
    expect(scoreFitsRubricBand(1.7, d10, "kickoff")).toBe(true);
    expect(scoreFitsRubricBand(4.2, d10, "kickoff")).toBe(false);
  });
});
