import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { evaluateDimensionCriteria } from "@/lib/scoring/criterionEvaluation";
import { applyJudgeAudit } from "@/lib/scoring/judgeConsistency";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { getCoachingRubric } from "@/lib/rubrics/coaching";

const kickoff01 = readFileSync("transcripts/kickoff-01.txt", "utf8");
const coaching01 = readFileSync("transcripts/coaching-01.txt", "utf8");

describe("judge consistency — Owen/Dana kickoff-01", () => {
  it("marks live booking rule met despite calendar deferral language elsewhere", () => {
    expect(hasLiveNextCallBooking(kickoff01)).toBe(true);
    const d10Rules = evaluateDimensionCriteria(
      {
        id: "d10",
        name: "Booking Next Call",
        score: 5,
        maxScore: 5,
        disabled: false,
        disabledReason: null,
        notApplicable: false,
        notApplicableReason: null,
        band: null,
        rationale: "The next call was not booked live.",
        evidence: [],
        quickFix: "",
        notDemonstrated: false,
        evidenceFound: false,
        verifiedEvidenceCount: 0,
        rejectedEvidenceCount: 0,
        evidenceStrength: "none",
      },
      kickoff01,
      "kickoff",
    );
    const booking = d10Rules.find((r) => r.id === "d10-live-booking");
    expect(booking?.status).toBe("met");
  });

  it("hydrates criteria on all kickoff dimensions and repairs booking contradiction", () => {
    const rubric = getKickoffRubric();
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Book next call live.",
          impact: "Continuity.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d10",
        },
        brief: "Strong call but booking missing.",
        redFlags: [
          {
            title: "No live booking",
            explanation: "Not booked.",
            evidence: "none",
          },
        ],
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
          rationale:
            d.id === "d10"
              ? "The next call was not booked live before hang-up."
              : "Strong.",
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
    expect(report.dimensions.every((d) => (d.criteriaResults?.length ?? 0) > 0)).toBe(
      true,
    );
    const d10 = report.dimensions.find((d) => d.id === "d10")!;
    expect(d10.criteriaResults?.find((c) => c.id === "d10-live-booking")?.status).toBe(
      "met",
    );
    expect(d10.rationale.toLowerCase()).not.toMatch(/not booked/);
    expect(report.redFlags).toHaveLength(0);
  });

  it("uses rule gaps for whyNotFullMarks on partial D9 without generic filler", () => {
    const rubric = getKickoffRubric();
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: { recommendation: "x", impact: "y", estimatedPointsGained: 3, scoreIfAppliedBasis: "d9" },
        brief: "x",
        redFlags: [],
        firedCapIds: [],
        notes: "",
        dimensions: rubric.dimensions.map((d) => ({
          id: d.id,
          score: d.id === "d9" ? 7 : d.maxScore,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale: "Could have been better.",
          evidence: [],
          quickFix: "Confirm workflow.",
          notDemonstrated: false,
        })),
      },
      rubric,
      modelName: "test",
      transcript: kickoff01,
    });
    const report = hydrateCompletedReport(base, kickoff01);
    const d9 = report.dimensions.find((d) => d.id === "d9")!;
    expect(d9.whyNotFullMarks).toBeNull();
    expect(d9.criteriaResults?.every((c) => c.status === "met" || c.status === "not_applicable")).toBe(
      true,
    );
  });
});

describe("judge consistency — Priya/Malik coaching-01", () => {
  it("detects verbal lock-in booking even when coach mentions sending times later", () => {
    expect(hasLiveNextCallBooking(coaching01)).toBe(true);
    expect(coaching01).toMatch(/lock that in/i);
    expect(coaching01).toMatch(/wednesday the 10th at four/i);
  });

  it("marks coaching D10 booking rule met and strips false booking red flags", () => {
    const rubric = getCoachingRubric();
    const base = applyCapsAndBuildResult({
      model: {
        oneThing: {
          recommendation: "Book next call live.",
          impact: "Continuity.",
          estimatedPointsGained: 5,
          scoreIfAppliedBasis: "d10",
        },
        brief: "Good session.",
        redFlags: [
          {
            title: "Next call not booked live",
            explanation: "Deferred to later.",
            evidence: "get you those times soon",
          },
        ],
        firedCapIds: ["next-call-not-booked"],
        notes: "",
        dimensions: rubric.dimensions.map((d) => ({
          id: d.id,
          score: d.id === "d10" ? 0 : d.maxScore,
          disabled: d.id === "d2",
          disabledReason: d.id === "d2" ? "N/A" : null,
          notApplicable: d.id === "d2",
          notApplicableReason: d.id === "d2" ? "N/A" : null,
          band: null,
          rationale:
            d.id === "d10"
              ? "The next call was not booked live."
              : "Strong.",
          evidence: [],
          quickFix: d.id === "d10" ? "Book live." : "",
          notDemonstrated: false,
        })),
      },
      rubric,
      modelName: "test",
      transcript: coaching01,
    });

    const audited = applyJudgeAudit(
      hydrateCompletedReport(base, coaching01),
      coaching01,
    );
    const d10 = audited.dimensions.find((d) => d.id === "d10")!;
    expect(d10.criteriaResults?.find((c) => c.id === "d10-live-booking")?.status).toBe(
      "met",
    );
    expect(d10.rationale.toLowerCase()).not.toMatch(/not booked/);
    expect(audited.redFlags.some((f) => /not booked/i.test(f.title))).toBe(false);
  });

  it("confirms later deadlines are captured in D9 rule audit", () => {
    const d9Rules = evaluateDimensionCriteria(
      {
        id: "d9",
        name: "Action Steps",
        score: 10,
        maxScore: 10,
        disabled: false,
        disabledReason: null,
        notApplicable: false,
        notApplicableReason: null,
        band: null,
        rationale: "Clear.",
        evidence: [],
        quickFix: "",
        notDemonstrated: false,
        evidenceFound: false,
        verifiedEvidenceCount: 0,
        rejectedEvidenceCount: 0,
        evidenceStrength: "none",
      },
      coaching01,
      "coaching",
    );
    const deadlines = d9Rules.find((r) => r.id === "d9-deadlines");
    expect(deadlines?.status).toBe("met");
    expect(deadlines?.note).toMatch(/recap|deadline/i);
  });
});
