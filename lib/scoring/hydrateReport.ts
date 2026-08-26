import { getRubric } from "@/lib/rubrics";
import type { EvaluationResult } from "@/lib/rubrics/types";
import { applyKickoffCloseCalibration } from "@/lib/scoring/kickoffClose";
import { nextEliteScore } from "@/lib/scoring/eliteBar";
import { gradeFromScore, normalizeToHundred } from "@/lib/scoring/calculate";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import {
  capScoreWithoutVerifiedEvidence,
  rewriteUnverifiedRationale,
  EVIDENCE_INSUFFICIENT_NOTE,
} from "@/lib/transcripts/evidencePolicy";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";

function recalculateTotals(result: EvaluationResult): EvaluationResult {
  let raw = 0;
  let available = 0;
  for (const d of result.dimensions) {
    if (d.disabled || d.notApplicable) continue;
    available += d.maxScore;
    if (d.score !== null) raw += d.score;
  }
  const scoreOutOf = available || result.scoreOutOf;
  const overallScore = normalizeToHundred(raw, scoreOutOf);
  const grade = gradeFromScore(overallScore, getRubric(result.callType));
  return { ...result, overallScore, scoreOutOf, grade };
}

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
  return recalculateTotals({ ...result, dimensions });
}

/**
 * Re-apply evidence caps on stored reports so unverified quotes cannot keep Elite.
 */
function applyEvidenceScoreCaps(result: EvaluationResult): EvaluationResult {
  const rubric = getRubric(result.callType);
  const byId = new Map(rubric.dimensions.map((d) => [d.id, d]));
  let changed = false;

  const dimensions = result.dimensions.map((dim) => {
    if (dim.disabled || dim.notApplicable || dim.score === null) return dim;
    if (dim.notDemonstrated) return dim;
    if (dim.verifiedEvidenceCount > 0) return dim;
    if (dim.rejectedEvidenceCount === 0) return dim;

    const def = byId.get(dim.id);
    const next = capScoreWithoutVerifiedEvidence(
      dim.score,
      def?.maxScore ?? dim.maxScore,
      def?.discreteScores,
    );
    if (next === dim.score) {
      const cleaned = rewriteUnverifiedRationale(dim.rationale);
      if (cleaned === dim.rationale && dim.rationale.includes("[Verification:")) {
        return dim;
      }
      changed = true;
      return {
        ...dim,
        rationale: dim.rationale.includes("[Verification:")
          ? dim.rationale
          : `${cleaned}${EVIDENCE_INSUFFICIENT_NOTE}`,
      };
    }

    changed = true;
    const cleaned = rewriteUnverifiedRationale(dim.rationale);
    return {
      ...dim,
      score: next,
      rationale: cleaned.includes("[Verification:")
        ? cleaned
        : `${cleaned}${EVIDENCE_INSUFFICIENT_NOTE}`,
    };
  });

  if (!changed) return result;
  return recalculateTotals({ ...result, dimensions });
}

/** Server-only: evidence metadata + quick-fix fallbacks. Do not import from client components. */
export function hydrateCompletedReport(
  result: EvaluationResult,
  transcript?: string | null,
): EvaluationResult {
  const calibrated = applyEvidenceScoreCaps(
    applyEliteBarCalibration(
      applyKickoffCloseCalibration(result, transcript),
      transcript,
    ),
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
