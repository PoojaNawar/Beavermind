import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import {
  backfillKickoffReportEvidence,
  dimensionNeedsEvidenceBackfill,
  pickKickoffEvidenceQuotes,
} from "@/lib/scoring/kickoffEvidenceBackfill";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { quoteExistsInTranscript } from "@/lib/transcripts/quoteMatch";
import type { DimensionResult } from "@/lib/rubrics/types";

const kickoff01 = readFileSync("transcripts/kickoff-01.txt", "utf8");
const kickoff02 = readFileSync("transcripts/kickoff-02.txt", "utf8");

function dim(partial: Partial<DimensionResult> & Pick<DimensionResult, "id">): DimensionResult {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    score: partial.score ?? 10,
    maxScore: partial.maxScore ?? 10,
    disabled: false,
    disabledReason: null,
    notApplicable: false,
    notApplicableReason: null,
    band: null,
    rationale: partial.rationale ?? "Test.",
    evidence: partial.evidence ?? [],
    quickFix: partial.quickFix ?? "",
    notDemonstrated: partial.notDemonstrated ?? false,
    evidenceFound: partial.evidenceFound ?? false,
    verifiedEvidenceCount: partial.verifiedEvidenceCount ?? 0,
    rejectedEvidenceCount: partial.rejectedEvidenceCount ?? 0,
    evidenceStrength: partial.evidenceStrength ?? "none",
    whyNotFullMarks: partial.whyNotFullMarks ?? null,
    ...partial,
  };
}

describe("kickoffEvidenceBackfill", () => {
  it("detects dimensions missing verified evidence", () => {
    expect(
      dimensionNeedsEvidenceBackfill(
        dim({ id: "d1", score: 10, evidence: [], verifiedEvidenceCount: 0 }),
      ),
    ).toBe(true);
    expect(
      dimensionNeedsEvidenceBackfill(
        dim({
          id: "d1",
          score: 10,
          evidence: [
            {
              quote: "I know you're forty-four and an architect.",
              speaker: "Dana",
              location: null,
              demonstrated: true,
              verificationStatus: "verified",
            },
          ],
          verifiedEvidenceCount: 1,
        }),
      ),
    ).toBe(false);
    expect(dimensionNeedsEvidenceBackfill(dim({ id: "d1", score: 0 }))).toBe(false);
  });

  it("picks transcript-grounded quotes for kickoff-01 dimensions", () => {
    for (const id of [
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
      "d7",
      "d8",
      "d9",
      "d10",
      "d11",
      "d12",
    ]) {
      const quotes = pickKickoffEvidenceQuotes(id, kickoff01, 10, 10);
      expect(quotes.length, id).toBeGreaterThan(0);
      for (const q of quotes) {
        expect(quoteExistsInTranscript(q.quote, kickoff01), id).toBe(true);
      }
    }
  });

  it("hydrates kickoff-01 stub report with verified evidence on every scored dimension", () => {
    const rubric = getKickoffRubric();
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Keep this standard.",
          impact: "Repeat elite execution.",
          estimatedPointsGained: null,
          scoreIfAppliedBasis: "",
        },
        brief: "Strong call.",
        redFlags: [],
        firedCapIds: [],
        notes: "",
        dimensions: rubric.dimensions.map((d) => ({
          id: d.id,
          score: d.id === "d1" ? 9 : d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "Strong dimension.",
          evidence: [],
          quickFix: "",
          notDemonstrated: false,
        })),
      },
      rubric,
      modelName: "test",
      transcript: kickoff01,
    });

    const report = hydrateCompletedReport(base, kickoff01);
    const scored = report.dimensions.filter(
      (d) => !d.disabled && !d.notApplicable && d.score !== null && d.score > 0,
    );
    expect(scored.length).toBe(12);
    for (const d of scored) {
      expect(d.verifiedEvidenceCount, d.id).toBeGreaterThan(0);
      expect(d.evidence.every((e) => e.verificationStatus === "verified"), d.id).toBe(
        true,
      );
    }
    expect(report.evidenceQuality.verified).toBeGreaterThanOrEqual(12);
  });

  it("does not overwrite existing verified evidence", () => {
    const rubric = getKickoffRubric();
    const existing =
      "I know you're forty-four, you're an architect out there in Portland.";
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "x",
          impact: "y",
          estimatedPointsGained: null,
          scoreIfAppliedBasis: "",
        },
        brief: "Strong call.",
        redFlags: [],
        firedCapIds: [],
        notes: "",
        dimensions: rubric.dimensions.map((d) => ({
          id: d.id,
          score: d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "Strong dimension.",
          evidence:
            d.id === "d1"
              ? [
                  {
                    quote: existing,
                    speaker: "Dana Whitlock",
                    location: null,
                    demonstrated: true,
                    verificationStatus: "verified" as const,
                  },
                ]
              : [],
          quickFix: "",
          notDemonstrated: false,
        })),
      },
      rubric,
      modelName: "test",
      transcript: kickoff01,
    });

    const report = hydrateCompletedReport(base, kickoff01);
    const d1 = report.dimensions.find((d) => d.id === "d1")!;
    expect(d1.evidence).toHaveLength(1);
    expect(d1.evidence[0]!.quote).toBe(existing);
  });

  it("backfills partial-score dimensions on kickoff-02 when evidence is empty", () => {
    const rubric = getKickoffRubric();
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Build North Star.",
          impact: "Align goals.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d4",
        },
        brief: "Mixed call.",
        redFlags: [],
        firedCapIds: ["no-north-star"],
        notes: "",
        dimensions: rubric.dimensions.map((d) => ({
          id: d.id,
          score: d.id === "d4" ? 5 : d.id === "d10" ? 3 : d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "Test.",
          evidence: [],
          quickFix: "",
          notDemonstrated: false,
        })),
      },
      rubric,
      modelName: "test",
      transcript: kickoff02,
    });

    const report = backfillKickoffReportEvidence(
      hydrateCompletedReport(base, kickoff02),
      kickoff02,
    );
    const d4 = report.dimensions.find((d) => d.id === "d4")!;
    expect(d4.verifiedEvidenceCount).toBeGreaterThan(0);
    for (const ev of d4.evidence) {
      expect(quoteExistsInTranscript(ev.quote, kickoff02)).toBe(true);
    }
  });
});
