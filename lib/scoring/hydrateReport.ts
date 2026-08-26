import { getRubric } from "@/lib/rubrics";
import type { EvaluationResult } from "@/lib/rubrics/types";
import { applyKickoffCloseCalibration } from "@/lib/scoring/kickoffClose";
import { nextEliteScore } from "@/lib/scoring/eliteBar";
import { gradeFromScore, normalizeToHundred } from "@/lib/scoring/calculate";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";

function applyEliteBarCalibration(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (!transcript?.trim()) return result;

  let changed = false;
  const dimensions = result.dimensions.map((d) => {
    const next = nextEliteScore(result.callType, d.id, d.score, transcript);
    if (next === d.score) return d;
    changed = true;
    return { ...d, score: next };
  });
  if (!changed) return result;

  let raw = 0;
  let available = 0;
  for (const d of dimensions) {
    if (d.disabled || d.notApplicable) continue;
    available += d.maxScore;
    if (d.score !== null) raw += d.score;
  }
  const scoreOutOf = available || result.scoreOutOf;
  const overallScore = normalizeToHundred(raw, scoreOutOf);
  const grade = gradeFromScore(overallScore, getRubric(result.callType));
  return { ...result, dimensions, overallScore, scoreOutOf, grade };
}

/** Server-only: evidence metadata + quick-fix fallbacks. Do not import from client components. */
export function hydrateCompletedReport(
  result: EvaluationResult,
  transcript?: string | null,
): EvaluationResult {
  const calibrated = applyEliteBarCalibration(
    applyKickoffCloseCalibration(result, transcript),
    transcript,
  );
  const hydrated = hydrateEvaluationResult(calibrated);
  return {
    ...hydrated,
    dimensions: refreshDimensionQuickFixes(
      hydrated.dimensions,
      getRubric(hydrated.callType),
    ),
  };
}
