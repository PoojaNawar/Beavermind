import { describe, expect, it } from "vitest";
import {
  hasDeficiencyLanguage,
  repairEvaluationConsistency,
} from "@/lib/scoring/consistency";
import { isIncompleteQuickFix } from "@/lib/scoring/quickFix";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
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
    expect(brief.held.toLowerCase()).toMatch(/next.?step/);
    expect(brief.next.toLowerCase()).toMatch(/close the loop|next step/);
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
});
