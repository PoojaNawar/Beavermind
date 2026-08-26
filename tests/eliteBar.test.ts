import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import {
  coachingHasCheckInElite,
  kickoffHasJourneyElite,
  kickoffHasNextStepsDemo,
  kickoffHasNextStepsElite,
  nextEliteScore,
} from "@/lib/scoring/eliteBar";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);

function stub(scores: Record<string, number | null>): ModelEvaluationOutput {
  const rubric = getKickoffRubric();
  return {
    oneThing: {
      recommendation: "Add a filming demo.",
      impact: "Client leaves with no filming confusion.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "D9 from 7 to 10",
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
      rationale: "Quote-first: the coach said X.",
      evidence: [],
      quickFix: "",
      notDemonstrated: false,
    })),
  };
}

describe("kickoff elite bar (transcript-grounded)", () => {
  it("does not treat kickoff-01 next steps as elite — there is no demo", () => {
    expect(kickoffHasNextStepsDemo(kickoff01)).toBe(false);
    expect(kickoffHasNextStepsElite(kickoff01)).toBe(false);
    expect(kickoffHasJourneyElite(kickoff01)).toBe(true);
  });

  it("keeps journey and coaching-intel at 10 on kickoff-01", () => {
    expect(nextEliteScore("kickoff", "d6", 10, kickoff01)).toBe(10);
    expect(nextEliteScore("kickoff", "d8", 10, kickoff01)).toBe(10);
  });

  it("caps next-steps 10/10 to Strong 7 when there is no demo", () => {
    expect(nextEliteScore("kickoff", "d9", 10, kickoff01)).toBe(7);
  });

  it("does not raise a Strong score", () => {
    expect(nextEliteScore("kickoff", "d9", 7, kickoff01)).toBe(7);
    expect(nextEliteScore("kickoff", "d2", 7, kickoff01)).toBe(7);
  });

  it("applies the D9 cap when building a kickoff-01 result", () => {
    const scores: Record<string, number | null> = {
      d1: 10,
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
    const result = applyCapsAndBuildResult({
      model: stub(scores),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(7);
    expect(result.dimensions.find((d) => d.id === "d2")?.score).toBe(7);
    expect(result.overallScore).toBe(94);
  });

  it("repairs a stored 10/10 D9 on refresh without a re-run", () => {
    const inflated = applyCapsAndBuildResult({
      model: stub({
        d1: 10,
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
      }),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    expect(inflated.dimensions.find((d) => d.id === "d9")?.score).toBe(10);
    expect(inflated.overallScore).toBe(97);

    const repaired = hydrateCompletedReport(inflated, kickoff01);
    expect(repaired.dimensions.find((d) => d.id === "d9")?.score).toBe(7);
    expect(repaired.overallScore).toBe(94);
  });
});

describe("coaching elite bar", () => {
  it("does not award check-in 10/10 for a surface hello", () => {
    const thin = "[Coach]: Hey, how's it going?\n[Client]: Good.\n[Coach]: Let's look at the program.";
    expect(coachingHasCheckInElite(thin)).toBe(false);
    expect(nextEliteScore("coaching", "d1", 10, thin)).toBe(7);
  });
});
