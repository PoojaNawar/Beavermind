import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import {
  applyKickoffCloseCalibration,
  filterKickoffTranscriptRedFlags,
  kickoffHasEliteClose,
  kickoffHasPostCallCommitment,
  kickoffHasStructuredRecap,
  kickoffHasSupportClarity,
  kickoffPostCallFloor,
} from "@/lib/scoring/kickoffClose";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { EvaluationResult } from "@/lib/rubrics/types";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);
const kickoff02 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-02.txt"),
  "utf8",
);

function stub(
  scores: Record<string, number | null>,
  rationale = "Quote-first: the coach said X.",
): ModelEvaluationOutput {
  const rubric = getKickoffRubric();
  return {
    oneThing: {
      recommendation: "Deepen rapport.",
      impact: "Client opens up.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "D2",
    },
    brief: "Strong kick-off.",
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
      rationale,
      evidence: [],
      quickFix: d.id === "d11" ? "Add a structured recap." : "",
      notDemonstrated: false,
    })),
  };
}

const ELITE_SCORES: Record<string, number | null> = {
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

describe("kickoff close calibration", () => {
  it("detects the elite recap, confidence, and emotion in kickoff-01", () => {
    expect(kickoffHasStructuredRecap(kickoff01)).toBe(true);
    expect(kickoffHasEliteClose(kickoff01)).toBe(true);
  });

  it("detects logistics recap and post-call commitments without hard-coding a call", () => {
    expect(kickoffHasStructuredRecap(kickoff02)).toBe(true);
    expect(kickoffHasEliteClose(kickoff02)).toBe(false);
    expect(kickoffHasPostCallCommitment(kickoff02)).toBe(true);
    expect(kickoffPostCallFloor(kickoff02)).toBeGreaterThanOrEqual(2.5);
    expect(kickoffHasSupportClarity(kickoff02)).toBe(true);
  });

  it("does not treat a short close as a structured recap", () => {
    const thin = "[Dana]: Ok, talk soon.\n[Owen]: Bye.";
    expect(kickoffHasStructuredRecap(thin)).toBe(false);
    expect(kickoffHasEliteClose(thin)).toBe(false);
    expect(kickoffHasPostCallCommitment(thin)).toBe(false);
  });

  it("does not cap D11 to 3 just because the rationale mentions a missing recap", () => {
    const result = applyCapsAndBuildResult({
      model: stub(ELITE_SCORES, "Typical gap: missing structured recap."),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    expect(result.overallScore).toBe(96);
  });

  it("restores D11 to 5 when kickoff-01 already has an elite close", () => {
    const scores = { ...ELITE_SCORES, d11: 3 };
    const result = applyCapsAndBuildResult({
      model: stub(scores, "No structured recap; generic close."),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    expect(result.overallScore).toBe(90);
  });

  it("caps D11 at 3 when the transcript has no recap", () => {
    const thin = "[Dana]: Ok, talk soon.\n[Owen]: Bye.";
    const result = applyCapsAndBuildResult({
      model: stub(ELITE_SCORES),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: thin,
    });
    expect(result.dimensions.find((d) => d.id === "d11")?.score).toBe(3);
    expect(result.dimensions.find((d) => d.id === "d6")?.score).toBe(7);
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(7);
  });

  it("floors D12 when the transcript has a timed coach deliverable", () => {
    const result = applyCapsAndBuildResult({
      model: stub({ ...ELITE_SCORES, d12: 0 }, "No post-call commitments."),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff02,
    });
    expect(result.dimensions.find((d) => d.id === "d12")?.score).toBeGreaterThanOrEqual(
      2.5,
    );
  });

  it("floors D12 to elite band when kickoff-01 has three timed commitments", () => {
    expect(kickoffPostCallFloor(kickoff01)).toBe(3.5);
    const result = applyCapsAndBuildResult({
      model: stub({ ...ELITE_SCORES, d12: 3 }, "Soft post-call mention."),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d12")?.score).toBe(3.5);
  });

  it("restores D7 when support channel, response time, and community are present", () => {
    const result = applyCapsAndBuildResult({
      model: stub({ ...ELITE_SCORES, d7: 3 }),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff02,
    });
    expect(result.dimensions.find((d) => d.id === "d7")?.score).toBe(5);
  });

  it("drops contradicted recap and soft North Star red flags on hydrate", () => {
    const scored = applyCapsAndBuildResult({
      model: {
        ...stub({ ...ELITE_SCORES, d4: 5, d10: 1.5, d11: 3, d12: 0 }),
        redFlags: [
          {
            title: "Missing North Star",
            explanation: "No North Star statement constructed.",
            evidence: "No North Star in call.",
          },
          {
            title: "No structured recap",
            explanation: "Call closed without a recap.",
            evidence: "No recap.",
          },
          {
            title: "Next call not booked live",
            explanation: "Scheduling deferred to assistant.",
            evidence: "assistant handles the scheduling",
          },
        ],
        firedCapIds: ["no-north-star"],
      },
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff02,
    });
    const hydrated = hydrateCompletedReport(scored, kickoff02);
    const titles = hydrated.redFlags.map((f) => f.title);
    expect(titles.some((t) => /north star/i.test(t))).toBe(false);
    expect(titles.some((t) => /recap/i.test(t))).toBe(false);
    expect(titles.some((t) => /book|schedul/i.test(t))).toBe(true);
    expect(hydrated.dimensions.find((d) => d.id === "d12")!.score!).toBeGreaterThanOrEqual(
      2.5,
    );
  });

  it("repairs a stored 94 result when the transcript has the elite close", () => {
    const scored = applyCapsAndBuildResult({
      model: stub({ ...ELITE_SCORES, d11: 3 }),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    expect(scored.overallScore).toBe(94);
    const repaired = applyKickoffCloseCalibration(
      scored as EvaluationResult,
      kickoff01,
    );
    expect(repaired.dimensions.find((d) => d.id === "d11")?.score).toBe(5);
    expect(repaired.overallScore).toBe(94.5);
    expect(repaired.grade).toBe("Elite");
  });

  it("filterKickoffTranscriptRedFlags is a no-op for coaching", () => {
    const base = {
      callType: "coaching" as const,
      redFlags: [
        {
          title: "Missing North Star",
          explanation: "x",
          evidence: "yyyyyyyy",
        },
      ],
    };
    const out = filterKickoffTranscriptRedFlags(
      base as EvaluationResult,
      kickoff02,
    );
    expect(out.redFlags).toHaveLength(1);
  });
});
