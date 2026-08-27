import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import {
  briefSections,
  dimensionOverview,
  dimensionStatusLabel,
  scoreHeadline,
} from "@/lib/ui/reportPresentation";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

function fixture(): ModelEvaluationOutput {
  const rubric = getKickoffRubric();
  return {
    oneThing: {
      recommendation: "Close the loop on next steps.",
      impact:
        "Make sure the client knows exactly what to do, where to do it, by when, and can confirm the workflow before the call ends.",
      estimatedPointsGained: 3,
      scoreIfAppliedBasis: "Next Steps",
    },
    brief: "Strong kick-off with a next-steps gap.",
    redFlags: [
      {
        title: "No live booking until the end",
        explanation: "Booking happened late.",
        evidence:
          "I'm sending you the calendar invite for that right now while we're still on the call.",
      },
    ],
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
      rationale:
        d.id === "d3"
          ? "Dana provided a clear agenda but did not fully sequence the phases or gain explicit client consent, which is necessary for a higher score."
          : d.id === "d9"
            ? "Next steps were stated but understanding was not fully confirmed."
            : `Verified evidence supports ${d.name}.`,
      evidence: [
        {
          quote:
            d.id === "d3"
              ? "We've got about forty-five minutes. First reconnect, then goals, then phases. Does that sound good?"
              : d.id === "d10"
                ? "I'm sending you the calendar invite for that right now while we're still on the call."
                : "Let's keep going with the plan.",
          speaker: "Coach",
          location: null,
          demonstrated: true,
          verificationStatus: "verified" as const,
        },
        ...(d.id === "d3"
          ? [
              {
                quote: "Yeah, that sounds good.",
                speaker: "Client",
                location: null,
                demonstrated: true,
                verificationStatus: "verified" as const,
              },
            ]
          : []),
      ],
      quickFix:
        d.id === "d9"
          ? "Confirm the diagnostic -> film -> upload workflow with the client."
          : d.id === "d3"
            ? "Gain consent."
            : "",
      notDemonstrated: false,
    })),
  };
}

describe("hydrated result page contract", () => {
  it("applies consistency + presentation so reopened reports stay coherent", () => {
    const rubric = getKickoffRubric();
    const stored = applyCapsAndBuildResult({
      model: fixture(),
      rubric,
      modelName: "test",
    });

    // Simulate reopening a completed evaluation (client hydrate path).
    const report = hydrateEvaluationResult(stored);
    const overview = dimensionOverview(report);
    const brief = briefSections(report);
    const d3 = report.dimensions.find((d) => d.id === "d3")!;
    const d9 = report.dimensions.find((d) => d.id === "d9")!;
    const d10 = report.dimensions.find((d) => d.id === "d10")!;

    expect(report.redFlags).toHaveLength(0);
    expect(d3.score).toBe(5);
    expect(d3.rationale).not.toMatch(/necessary for a higher score|did not fully/i);
    expect(dimensionStatusLabel(d3, report)).toBe("FULL MARKS");
    expect(d9.score).toBe(7);
    expect(dimensionStatusLabel(d9, report)).toBe("OPPORTUNITY");
    expect(d10.score).toBe(5);
    expect(overview.summary).toMatch(/strong/i);
    expect(overview.summary).toMatch(/opportunit/i);
    expect(overview.opportunities).toBeGreaterThan(0);
    expect(brief.held.toLowerCase()).toMatch(/next.?step/);
    expect(brief.next.toLowerCase()).toMatch(/close the loop|next step/);
    expect(report.oneThing.recommendation).toMatch(/close the loop on next steps/i);
    expect(scoreHeadline(report)).toMatch(/next.?step|gap/i);
  });
});
