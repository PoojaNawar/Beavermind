import { getRubric } from "@/lib/rubrics";
import type { EvaluationResult } from "@/lib/rubrics/types";
import { applyKickoffCloseCalibration } from "@/lib/scoring/kickoffClose";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";

/** Server-only: evidence metadata + quick-fix fallbacks. Do not import from client components. */
export function hydrateCompletedReport(
  result: EvaluationResult,
  transcript?: string | null,
): EvaluationResult {
  const calibrated = applyKickoffCloseCalibration(result, transcript);
  const hydrated = hydrateEvaluationResult(calibrated);
  return {
    ...hydrated,
    dimensions: refreshDimensionQuickFixes(
      hydrated.dimensions,
      getRubric(hydrated.callType),
    ),
  };
}
