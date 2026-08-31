import type { Rubric } from "@/lib/rubrics/types";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import {
  kickoffBookingMeritScore,
  kickoffDeepWhyMeritScore,
  scoreFitsRubricBand,
} from "@/lib/scoring/meritCaps";
import { hasLeakedScoringMechanics } from "@/lib/scoring/textHygiene";

export function validateModelScoring(args: {
  model: ModelEvaluationOutput;
  rubric: Rubric;
  transcript: string;
}): string[] {
  const { model, rubric, transcript } = args;
  const errors: string[] = [];

  for (const dim of model.dimensions) {
    const def = rubric.dimensions.find((d) => d.id === dim.id);
    if (!def || dim.disabled || dim.notApplicable || dim.score === null) {
      continue;
    }

    if (!scoreFitsRubricBand(dim.score, def, rubric.id)) {
      errors.push(
        `Dimension ${dim.id} score ${dim.score} does not fall inside any rubric band for ${def.name}.`,
      );
    }

    if (
      dim.score < def.maxScore &&
      dim.quickFix.trim() &&
      hasLeakedScoringMechanics(dim.quickFix)
    ) {
      errors.push(
        `Dimension ${dim.id} quickFix contains scoring/meta language instead of a coach action.`,
      );
    }
  }

  if (rubric.id === "kickoff") {
    const d4 = model.dimensions.find((d) => d.id === "d4");
    if (
      d4 &&
      d4.score !== null &&
      !d4.disabled &&
      !d4.notApplicable &&
      model.firedCapIds.includes("no-north-star") &&
      d4.score === 10
    ) {
      const merit = kickoffDeepWhyMeritScore(transcript);
      if (merit <= 5) {
        errors.push(
          `Dimension d4 scored 10/15 with no-North-Star cap but transcript supports Mid (${merit}/15) — score merit first, then apply cap.`,
        );
      }
    }

    const d10 = model.dimensions.find((d) => d.id === "d10");
    if (d10 && d10.score === 0 && !d10.disabled && !d10.notApplicable) {
      const merit = kickoffBookingMeritScore(transcript);
      if (merit >= 2.5) {
        errors.push(
          `Dimension d10 scored 0/5 but next-call booking was mentioned (Mid band ~${merit}/5) — Fail requires no mention at all.`,
        );
      }
    }
  }

  return errors;
}
