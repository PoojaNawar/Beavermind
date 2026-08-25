import { getRubric } from "@/lib/rubrics";
import type { EvaluationResult } from "@/lib/rubrics/types";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";

/** Server-only: evidence metadata + quick-fix fallbacks. Do not import from client components. */
export function hydrateCompletedReport(
  result: EvaluationResult,
): EvaluationResult {
  const hydrated = hydrateEvaluationResult(result);
  return {
    ...hydrated,
    dimensions: refreshDimensionQuickFixes(
      hydrated.dimensions,
      getRubric(hydrated.callType),
    ),
  };
}
