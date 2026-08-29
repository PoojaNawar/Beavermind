import { describe, expect, it } from "vitest";
import {
  hasDeficiencyLanguage,
  repairEvaluationConsistency,
} from "@/lib/scoring/consistency";
import { isIncompleteQuickFix } from "@/lib/scoring/quickFix";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { resolveLeverageTheme } from "@/lib/scoring/scoreIfApplied";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";
import { briefSections, refineOneThing } from "@/lib/ui/reportPresentation";
import type { EvaluationResult } from "@/lib/rubrics/types";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import type { Rubric } from "@/lib/rubrics/types";

function modelFor(
  rubric: Rubric,
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput>,
): ModelEvaluationOutput {
  return {
    oneThing: extras?.oneThing ?? {
      recommendation: "Raise Next Steps & Diagnostics before the next call.",
      impact: "This will improve the coaching experience.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "d9",
    },
    brief: extras?.brief ?? "Mixed call.",
    redFlags: extras?.redFlags ?? [],
    firedCapIds: extras?.firedCapIds ?? [],
    notes: extras?.notes ?? "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: scores[d.id] ?? d.maxScore,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale:
        extras?.dimensions?.find((x) => x.id === d.id)?.rationale ??
        `The coach covered ${d.name} well.`,
      evidence: extras?.dimensions?.find((x) => x.id === d.id)?.evidence ?? [
        {
          quote: "I'm sending you the calendar invite for that right now while we're still on the call.",
          speaker: "Coach",
          location: null,
          demonstrated: true,
          verificationStatus: "verified" as const,
        },
      ],
      quickFix: extras?.dimensions?.find((x) => x.id === d.id)?.quickFix ?? "",
      notDemonstrated:
        extras?.dimensions?.find((x) => x.id === d.id)?.notDemonstrated ?? false,
    })),
  };
}

function buildKickoff(
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput>,
): EvaluationResult {
  const rubric = getKickoffRubric();
  return hydrateEvaluationResult(
    applyCapsAndBuildResult({
      model: modelFor(rubric, scores, extras),
      rubric,
      modelName: "test",
    }),
  );
}

function buildCoaching(
  scores: Record<string, number | null>,
  extras?: Partial<ModelEvaluationOutput>,
): EvaluationResult {
  const rubric = getCoachingRubric();
  return hydrateEvaluationResult(
    applyCapsAndBuildResult({
      model: modelFor(rubric, scores, extras),
      rubric,
      modelName: "test",
    }),
  );
}

describe("consistency repair", () => {
  it("lowers unsupported full marks when rationale and verified evidence agree on a gap", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const raw = applyCapsAndBuildResult({
      model: modelFor(rubric, scores, {
        dimensions: [
          {
            id: "d3",
            score: 5,
            disabled: false,
            disabledReason: null,
            notApplicable: false,
            notApplicableReason: null,
            band: null,
            rationale:
              "Dana provided a clear agenda but did not fully sequence the phases or gain explicit client consent for the structure, which is necessary for a higher score.",
            evidence: [
              {
                quote: "Here's our agenda for today.",
                speaker: "Coach",
                location: null,
                demonstrated: true,
                verificationStatus: "verified",
              },
            ],
            quickFix: "Gain explicit consent for the agenda.",
            notDemonstrated: false,
          },
        ],
      }),
      rubric,
      modelName: "test",
    });

    const { result } = repairEvaluationConsistency(raw);
    const d3 = result.dimensions.find((d) => d.id === "d3")!;
    expect(d3.score).toBe(3);
    expect(hasDeficiencyLanguage(d3.rationale)).toBe(true);
    expect(d3.quickFix).toMatch(/consent|sequenced|phases/i);
    expect(d3.quickFix).not.toMatch(/full marks reached/i);
  });

  it("keeps full marks and repairs rationale when verified evidence supports Elite", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const raw = applyCapsAndBuildResult({
      model: modelFor(rubric, scores, {
        dimensions: [
          {
            id: "d3",
            score: 5,
            disabled: false,
            disabledReason: null,
            notApplicable: false,
            notApplicableReason: null,
            band: null,
            rationale:
              "Dana provided a clear agenda but did not fully sequence the phases or gain explicit client consent for the structure, which is necessary for a higher score.",
            evidence: [
              {
                quote:
                  "We've got about forty-five minutes together. First we'll reconnect, then clarify goals, then walk the three phases. Does that sound good?",
                speaker: "Coach",
                location: null,
                demonstrated: true,
                verificationStatus: "verified",
              },
              {
                quote: "Yeah, that sounds good.",
                speaker: "Client",
                location: null,
                demonstrated: true,
                verificationStatus: "verified",
              },
            ],
            quickFix: "Gain explicit consent for the agenda.",
            notDemonstrated: false,
          },
        ],
      }),
      rubric,
      modelName: "test",
    });

    const { result } = repairEvaluationConsistency(raw);
    const d3 = result.dimensions.find((d) => d.id === "d3")!;
    expect(d3.score).toBe(5);
    expect(hasDeficiencyLanguage(d3.rationale)).toBe(false);
    expect(d3.quickFix).toMatch(/full marks reached/i);
  });

  it("removes booking red flags when live booking scored full marks", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = buildKickoff(scores, {
      redFlags: [
        {
          title: "No live booking until the end",
          explanation: "Booking was left until the end of the call.",
          evidence: "I'm sending you the calendar invite for that right now",
        },
      ],
    });
    expect(result.dimensions.find((d) => d.id === "d10")?.score).toBe(5);
    expect(result.redFlags).toHaveLength(0);
  });

  it("rejects truncated Quick Fixes with unclosed parentheses", () => {
    expect(isIncompleteQuickFix("Name two intake details (goals")).toBe(true);
    expect(
      isIncompleteQuickFix(
        "Name two intake details (goals and constraints) early in the call.",
      ),
    ).toBe(false);
  });

  it("One Thing uses action language for next-steps gap", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d9 = 7;
    const result = buildKickoff(scores);
    const one = refineOneThing(result);
    expect(one.recommendation).toMatch(/close the loop on next steps/i);
    expect(one.recommendation).not.toMatch(/raise next steps/i);
    expect(one.impact).toMatch(/what to do|where|by when|confirm/i);
  });

  it("brief sections agree with dimension scores", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d9 = 7;
    const result = buildKickoff(scores);
    const brief = briefSections(result);
    expect(brief.well.toLowerCase()).not.toMatch(/next.?step/);
    expect(brief.well.length).toBeGreaterThan(40);
    expect(brief.held.toLowerCase()).toMatch(/next.?step/);
    expect(brief.held).toMatch(/confirm|understanding/i);
    expect(brief.next).toMatch(/diagnostic|film|upload|confirm/i);
    expect(brief.next).not.toMatch(/^Close the loop/i);
  });

  it("full-mark Quick Fix has no body when evidence supports the score", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    const result = buildKickoff(scores, {
      dimensions: [
        {
          id: "d5",
          score: 10,
          disabled: false,
          disabledReason: null,
          notApplicable: false,
          notApplicableReason: null,
          band: null,
          rationale:
            "Dana explained the phases well but did not fully tie them to Owen's goal.",
          evidence: [
            {
              quote:
                "Retraining builds the foundation, Remodeling frames the structure, and Integrating occupies the building — for your golf swing and belay goal specifically.",
              speaker: "Coach",
              location: null,
              demonstrated: true,
              verificationStatus: "verified",
            },
            {
              quote: "Invented quote not in transcript.",
              speaker: "Coach",
              location: null,
              demonstrated: true,
              verificationStatus: "unverified",
            },
          ],
          quickFix: "Tie phases to the goal.",
          notDemonstrated: false,
        },
      ],
    });
    const d5 = result.dimensions.find((d) => d.id === "d5")!;
    expect(d5.score).toBe(10);
    expect(hasDeficiencyLanguage(d5.rationale)).toBe(false);
    const qf = presentQuickFix(d5, "kickoff");
    expect(qf?.complete).toBe(true);
    expect(qf?.body).toBeNull();
    expect(qf?.title).toMatch(/full marks reached/i);
  });

  it("potential score basis is labeled illustrative", () => {
    const rubric = getKickoffRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) scores[d.id] = d.maxScore;
    scores.d9 = 7;
    const result = buildKickoff(scores);
    expect(result.oneThing.scoreIfApplied).not.toBeNull();
    expect(result.oneThing.scoreIfAppliedBasis).toMatch(/illustrative projection/i);
  });

  it("coaching One Thing follows the largest gap when vision is tied with accountability", () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {
      d1: 10,
      d2: null,
      d3: 10,
      d4: null,
      d5: 7,
      d6: 10,
      d7: 3,
      d8: 5,
      d9: 5,
      d10: 5,
      d11: 3,
      d12: 5,
    };
    const raw = applyCapsAndBuildResult({
      model: modelFor(rubric, scores, {
        oneThing: {
          recommendation: "Strengthen program focus + vision.",
          impact: "This was the largest meaningful score gap on this evaluation.",
          estimatedPointsGained: 6,
          scoreIfAppliedBasis: "d3",
        },
        brief:
          "The call demonstrated strong connection but lacked specific commitments and accountability measures.",
        dimensions: [
          {
            id: "d2",
            score: null,
            disabled: true,
            disabledReason: "notApplicable",
            notApplicable: true,
            notApplicableReason: "Not a milestone call.",
            band: null,
            rationale: "",
            evidence: [],
            quickFix: "",
            notDemonstrated: false,
          },
          {
            id: "d4",
            score: null,
            disabled: true,
            disabledReason: "notApplicable",
            notApplicable: true,
            notApplicableReason: "No movement coaching occurred.",
            band: null,
            rationale: "",
            evidence: [],
            quickFix: "",
            notDemonstrated: false,
          },
          {
            id: "d6",
            score: 10,
            disabled: false,
            disabledReason: null,
            notApplicable: false,
            notApplicableReason: null,
            band: null,
            rationale:
              "The coach outlined clear commitments but they lacked specific deadlines and measurable outcomes.",
            evidence: [
              {
                quote:
                  "the three sessions we just mapped out, Tuesday, Wednesday, Friday, logged in the training app as they happen, that's the baseline.",
                speaker: "Marcus Reid",
                location: null,
                demonstrated: true,
                verificationStatus: "verified",
              },
            ],
            quickFix: "Add deadlines.",
            notDemonstrated: false,
          },
        ],
      }),
      rubric,
      modelName: "test",
    });
    raw.dimensions.find((d) => d.id === "d2")!.disabled = true;
    raw.dimensions.find((d) => d.id === "d2")!.notApplicable = true;
    raw.dimensions.find((d) => d.id === "d4")!.disabled = true;
    raw.dimensions.find((d) => d.id === "d4")!.notApplicable = true;

    const result = hydrateEvaluationResult(raw);
    expect(resolveLeverageTheme(result)).toBe("largest-gap");
    const one = refineOneThing(result);
    expect(one.recommendation).toMatch(/accountability|continuity|anchor/i);
    expect(one.recommendation).not.toMatch(/program focus \+ vision/i);
    expect(result.brief.toLowerCase()).not.toMatch(/lacked specific commitments/);
    const brief = briefSections(result);
    expect(brief.held.toLowerCase()).toMatch(/accountab|anchor|continuity/);
  });
});
