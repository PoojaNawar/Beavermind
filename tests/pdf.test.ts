import { describe, expect, it } from "vitest";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { buildEvaluationPdf } from "@/lib/pdf/generate";
import { pdfSafeText } from "@/lib/pdf/text";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

describe("pdfSafeText", () => {
  it("turns smart quotes, em dashes, and arrows into Helvetica-safe ASCII", () => {
    expect(pdfSafeText("Hannah’s “win” — then next → film")).toBe(
      'Hannah\'s "win" - then next -> film',
    );
  });
});

describe("buildEvaluationPdf", () => {
  it("builds a PDF when the report contains quotes, dashes, and arrows", async () => {
    const rubric = getCoachingRubric();
    const scores: Record<string, number | null> = {};
    for (const d of rubric.dimensions) {
      scores[d.id] = d.id === "d4" ? null : d.id === "d10" ? 0 : Math.min(7, d.maxScore);
    }
    const model: ModelEvaluationOutput = {
      oneThing: {
        recommendation:
          "Encourage Hannah to share her experiences in the community platform more frequently.",
        impact: "She’ll feel more connected — that’s the point.",
        estimatedPointsGained: 5,
        scoreIfAppliedBasis: "D6",
      },
      brief: "The call was strong, but next call wasn’t booked live…",
      redFlags: [
        {
          title: "Next call NOT booked live",
          explanation: "The next call wasn’t booked during the call.",
          evidence: "“We’ll figure out a time later.”",
        },
      ],
      firedCapIds: ["next-call-not-booked"],
      notes: "",
      dimensions: rubric.dimensions.map((d) => ({
        id: d.id,
        score: scores[d.id] ?? 0,
        disabled: d.id === "d4",
        disabledReason: d.id === "d4" ? "no movement coaching" : null,
        notApplicable: false,
        notApplicableReason: null,
        band: null,
        rationale: "Quote-first: “that’s exactly it.”",
        evidence: [
          {
            quote: "We’ll figure out a time later — not now.",
            speaker: "Marcus Reid",
            location: null,
            demonstrated: true,
          },
        ],
        quickFix: "Confirm the diagnostic → film → upload workflow.",
        notDemonstrated: false,
      })),
    };

    const result = applyCapsAndBuildResult({
      model,
      rubric,
      modelName: "test",
    });

    const pdf = await buildEvaluationPdf(result, {
      id: "4027baf1-9349-4f2a-b4ca-b9a0f3528bf0",
      createdAt: new Date().toISOString(),
      clientName: "owen",
      coachName: "dana",
    });

    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
    const asText = pdf.toString("latin1");
    expect(asText).not.toMatch(/d10 forced/i);
    expect(asText).not.toMatch(/Capped:/);
  });
});
