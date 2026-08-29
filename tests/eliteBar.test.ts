import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import {
  coachingHasCheckInElite,
  coachingHasLiveMovementCoaching,
  coachingHasMovementElite,
  coachingMovementScore,
  kickoffHasAgendaElite,
  kickoffAgendaIsUpfront,
  kickoffCloseFeelsRushed,
  kickoffHasDeepWhyElite,
  kickoffHasJourneyElite,
  kickoffHasNextStepsConfirmation,
  kickoffHasNextStepsElite,
  kickoffHasPrepElite,
  kickoffHasProgramElite,
  kickoffHasRapportElite,
  kickoffPersonalShareAfterAgenda,
  nextEliteScore,
} from "@/lib/scoring/eliteBar";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { DimensionResult } from "@/lib/rubrics/types";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);
const coaching01 = readFileSync(
  path.join(process.cwd(), "transcripts/coaching-01.txt"),
  "utf8",
);

function stub(
  rubric: ReturnType<typeof getKickoffRubric>,
  scores: Record<string, number | null>,
): ModelEvaluationOutput {
  return {
    oneThing: {
      recommendation: "Deepen one elite behaviour.",
      impact: "The call lands.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "dimension",
    },
    brief: "Scored from the transcript.",
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

describe("kickoff-01 quality bar (independent of a prior 87)", () => {
  it("treats next-steps elite as understanding, not a required demo", () => {
    expect(kickoffHasNextStepsConfirmation(kickoff01)).toBe(true);
    expect(kickoffHasNextStepsElite(kickoff01)).toBe(true);
    expect(kickoffHasJourneyElite(kickoff01)).toBe(true);
    expect(kickoffHasProgramElite(kickoff01)).toBe(true);
    expect(kickoffHasDeepWhyElite(kickoff01)).toBe(true);
    expect(kickoffHasRapportElite(kickoff01)).toBe(true);
    expect(kickoffHasPrepElite(kickoff01)).toBe(true);
  });

  it("floors near-elite prep to 10 when CRM details are present", () => {
    expect(nextEliteScore("kickoff", "d1", 9, kickoff01)).toBe(9);
    const result = applyCapsAndBuildResult({
      model: stub(getKickoffRubric(), {
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
      }),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d1")?.score).toBe(9);
  });

  it("caps inflated kickoff-01 scores only where the transcript lacks elite criteria", () => {
    expect(kickoffAgendaIsUpfront(kickoff01)).toBe(false);
    expect(kickoffPersonalShareAfterAgenda(kickoff01)).toBe(true);
    expect(kickoffCloseFeelsRushed(kickoff01)).toBe(true);
    const result = applyCapsAndBuildResult({
      model: stub(getKickoffRubric(), {
        d1: 9,
        d2: 10,
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
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d2")?.score).toBe(10);
    expect(result.dimensions.find((d) => d.id === "d3")?.score).toBe(5);
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(10);
    expect(result.dimensions.find((d) => d.id === "d12")?.score).toBe(5);
    expect(result.overallScore).toBeGreaterThanOrEqual(97);
  });

  it("caps prep Elite when intake details are missing", () => {
    const thin =
      "[Dana]: I looked at your notes.\n[Owen]: Cool.\n[Dana]: Let's start.";
    expect(kickoffHasPrepElite(thin)).toBe(false);
    expect(nextEliteScore("kickoff", "d1", 10, thin)).toBe(7);
  });

  it("does not raise a Strong rapport score", () => {
    expect(nextEliteScore("kickoff", "d2", 7, kickoff01)).toBe(7);
  });

  it("keeps agenda Elite when time, sequence, and consent are present (upfront timing not required)", () => {
    expect(kickoffHasAgendaElite(kickoff01)).toBe(true);
    expect(kickoffAgendaIsUpfront(kickoff01)).toBe(false);
    expect(nextEliteScore("kickoff", "d3", 5, kickoff01)).toBe(5);
    const thin =
      "[Dana]: Today we'll talk goals and program.\n[Owen]: Okay.";
    expect(kickoffHasAgendaElite(thin)).toBe(false);
    expect(nextEliteScore("kickoff", "d3", 5, thin)).toBe(3);
  });

  it("does not cap kickoff-01 next steps when later recap confirms understanding", () => {
    expect(nextEliteScore("kickoff", "d9", 10, kickoff01)).toBe(10);
  });

  it("caps next-steps 10 when the client never confirms understanding", () => {
    const thin =
      "[Dana]: Film diagnostics and upload them.\n[Owen]: Okay.";
    expect(nextEliteScore("kickoff", "d9", 10, thin)).toBe(7);
  });

  it("caps program 9-10 when only the three names are listed", () => {
    const namesOnly =
      "[Dana]: Retraining, Remodeling, Integrating. That's the method.\n[Owen]: Okay.";
    expect(nextEliteScore("kickoff", "d5", 10, namesOnly)).toBe(8);
  });

  it("caps deep-why 15 when the why is never stated back or confirmed", () => {
    const thin =
      "[Dana]: So you want less pain.\n[Owen]: Yeah.\n[Dana]: Great, let's talk program.";
    expect(nextEliteScore("kickoff", "d4", 15, thin)).toBe(10);
  });

  it("builds kickoff-01 totals from this transcript, not a stored 87", () => {
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
      model: stub(getKickoffRubric(), scores),
      rubric: getKickoffRubric(),
      modelName: "test",
      transcript: kickoff01,
    });
    expect(result.dimensions.find((d) => d.id === "d2")?.score).toBe(10);
    expect(result.dimensions.find((d) => d.id === "d9")?.score).toBe(10);
    expect(result.overallScore).toBe(100);
  });

  it("repairs kickoff-01 on hydrate when transcript proves elite but model under-scored", () => {
    const stored = applyCapsAndBuildResult({
      model: stub(getKickoffRubric(), {
        d1: 10,
        d2: 7,
        d3: 5,
        d4: 15,
        d5: 7,
        d6: 10,
        d7: 5,
        d8: 10,
        d9: 7,
        d10: 5,
        d11: 5,
        d12: 3.5,
      }),
      rubric: getKickoffRubric(),
      modelName: "test",
    });
    const repaired = hydrateCompletedReport(stored, kickoff01);
    expect(repaired.dimensions.find((d) => d.id === "d2")?.score).toBe(10);
    expect(repaired.dimensions.find((d) => d.id === "d3")?.score).toBe(5);
    expect(repaired.dimensions.find((d) => d.id === "d5")?.score).toBe(10);
    expect(repaired.dimensions.find((d) => d.id === "d9")?.score).toBe(10);
    expect(repaired.dimensions.find((d) => d.id === "d12")?.score).toBe(5);
    expect(repaired.overallScore).toBeGreaterThanOrEqual(100);
  });
});

describe("coaching-01 quality bar", () => {
  it("treats a real check-in as elite and a surface hello as Strong", () => {
    expect(coachingHasCheckInElite(coaching01)).toBe(true);
    expect(nextEliteScore("coaching", "d1", 10, coaching01)).toBe(10);
    const hello =
      "[Coach]: Hey, how's it going?\n[Client]: Good.\n[Coach]: Let's look at the program.";
    expect(coachingHasCheckInElite(hello)).toBe(false);
    expect(nextEliteScore("coaching", "d1", 10, hello)).toBe(7);
  });

  it("forces next-call booking to 0 when the call was not booked live", () => {
    const deferred =
      "Great work today. My assistant will reach out with some times next week.";
    expect(nextEliteScore("coaching", "d10", 5, deferred)).toBe(0);
  });

  it("caps vision / accountability Elite when transcript markers are missing", () => {
    const thin =
      "[Coach]: Keep doing the workouts.\n[Client]: Okay.\n[Coach]: Talk later.";
    expect(nextEliteScore("coaching", "d3", 15, thin)).toBe(10);
    expect(nextEliteScore("coaching", "d6", 15, thin)).toBe(10);
    expect(nextEliteScore("coaching", "d7", 5, thin)).toBe(3);
    expect(nextEliteScore("coaching", "d11", 5, thin)).toBe(3);
  });
});

function dim(
  overrides: Partial<DimensionResult> &
    Pick<DimensionResult, "id" | "name" | "score" | "maxScore" | "quickFix">,
): DimensionResult {
  return {
    disabled: false,
    disabledReason: null,
    notApplicable: false,
    notApplicableReason: null,
    band: null,
    rationale: "Scored from the rubric bands.",
    evidence: [],
    notDemonstrated: false,
    evidenceFound: false,
    verifiedEvidenceCount: 0,
    rejectedEvidenceCount: 0,
    evidenceStrength: "low",
    ...overrides,
  };
}

describe("coaching movement D4 repair", () => {
  it("detects live movement coaching on coaching-01", () => {
    expect(coachingHasLiveMovementCoaching(coaching01)).toBe(true);
    expect(coachingHasMovementElite(coaching01)).toBe(true);
    expect(coachingMovementScore(coaching01)).toBe(15);
  });

  it("re-enables D4 when the model wrongly disables it", () => {
    const rubric = getCoachingRubric();
    const model = stub(rubric, {
      d1: 10,
      d2: null,
      d3: 10,
      d4: null,
      d5: 7,
      d6: 10,
      d7: 3,
      d8: 5,
      d9: 3,
      d10: 0,
      d11: 3,
      d12: 5,
    });
    const d4 = model.dimensions.find((d) => d.id === "d4")!;
    d4.disabled = true;
    d4.notApplicable = true;
    d4.disabledReason = "No movement coaching occurred in this call.";
    d4.notApplicableReason = "No movement coaching occurred in this call.";
    d4.score = null;

    const d2 = model.dimensions.find((d) => d.id === "d2")!;
    d2.notApplicable = true;
    d2.score = null;

    const result = applyCapsAndBuildResult({
      model,
      rubric,
      modelName: "test",
      transcript: coaching01,
    });
    const repaired = result.dimensions.find((d) => d.id === "d4")!;
    expect(repaired.disabled).toBe(false);
    expect(repaired.notApplicable).toBe(false);
    expect(repaired.score).toBe(15);
    expect(result.scoreOutOf).toBe(95);
  });
});

describe("kickoff and coaching quick fixes", () => {
  it("renders kickoff next-steps as a clean workflow, not a broken separator", () => {
    const view = presentQuickFix(
      dim({
        id: "d9",
        name: "Next Steps & Diagnostics",
        score: 7,
        maxScore: 10,
        quickFix:
          "Confirm the diagnostic !' film !' upload pipeline with a how-to and a timeline they repeat back.",
      }),
      "kickoff",
    );
    expect(view?.title).toBe("Confirm the diagnostic → film → upload workflow");
    expect(view?.title).not.toMatch(/!'/);
    expect(view?.body).toMatch(/what the client needs to record/i);
    expect(view?.body).toMatch(/understands the sequence/i);
  });

  it("renders a coaching check-in personal-share gap as a specific connection action", () => {
    const view = presentQuickFix(
      dim({
        id: "d1",
        name: "Check-In & Connection",
        score: 7,
        maxScore: 10,
        quickFix: "Share a personal story.",
      }),
      "coaching",
    );
    expect(view?.title).toBe("Deepen the personal connection");
    expect(view?.body).toMatch(/mirrors the client's situation/i);
  });
});
