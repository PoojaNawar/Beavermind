import { getRubric } from "@/lib/rubrics";
import type { DimensionResult, EvaluationResult } from "@/lib/rubrics/types";
import {
  applyKickoffCloseCalibration,
  filterKickoffTranscriptRedFlags,
  mergeKickoffDisclosureRedFlags,
} from "@/lib/scoring/kickoffClose";
import {
  floorEliteScore,
  nextEliteScore,
  repairCoachingBookingDimension,
  repairCoachingMovementDimension,
} from "@/lib/scoring/eliteBar";
import { applyTranscriptAutoCaps } from "@/lib/scoring/transcriptCaps";
import { resolveFiredCapIds } from "@/lib/scoring/detectCaps";
import {
  applyKickoffMeritScoring,
  attachKickoffCapNotes,
  enrichFiredCapEffects,
} from "@/lib/scoring/meritCaps";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import { gradeFromScore, normalizeToHundred } from "@/lib/scoring/calculate";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import {
  capScoreWithoutVerifiedEvidence,
  rewriteUnverifiedRationale,
  EVIDENCE_INSUFFICIENT_NOTE,
} from "@/lib/transcripts/evidencePolicy";
import {
  hydrateEvaluationResult,
  summarizeDimensionEvidence,
  summarizeReportEvidence,
} from "@/lib/transcripts/evidenceQuality";

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

function applyCoachingTranscriptRepairs(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "coaching" || !transcript?.trim()) return result;

  let changed = false;
  const dimensions: DimensionResult[] = result.dimensions.map((d) => {
    let next = repairCoachingMovementDimension(d, transcript);
    next = repairCoachingBookingDimension(next, transcript);
    if (
      next.disabled !== d.disabled ||
      next.notApplicable !== d.notApplicable ||
      next.score !== d.score
    ) {
      changed = true;
      const quality = summarizeDimensionEvidence(
        next.evidence,
        next.notDemonstrated,
      );
      return { ...next, ...quality } satisfies DimensionResult;
    }
    return d;
  });
  if (!changed) return result;
  let withDims: EvaluationResult = {
    ...result,
    dimensions,
    evidenceQuality: summarizeReportEvidence(dimensions),
  };
  withDims = recalculateTotals(withDims);
  if (hasLiveNextCallBooking(transcript)) {
    withDims = {
      ...withDims,
      firedCaps: withDims.firedCaps.filter((c) => c.id !== "next-call-not-booked"),
    };
  }
  return withDims;
}

function applyEliteBarCalibration(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (!transcript?.trim()) return result;

  let changed = false;
  const dimensions = result.dimensions.map((d) => {
    let next = nextEliteScore(result.callType, d.id, d.score, transcript);
    next = floorEliteScore(result.callType, d.id, next, transcript);
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

export function applyKickoffMeritHydration(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "kickoff" || !transcript?.trim()) return result;

  const rubric = getRubric("kickoff");
  const dimensions = result.dimensions.map((d) => ({ ...d }));
  const before = dimensions.map((d) => d.score);

  applyKickoffMeritScoring(dimensions, transcript);
  const capIds = resolveFiredCapIds({
    callType: "kickoff",
    transcript,
    modelFiredIds: result.firedCaps.map((c) => c.id),
  });
  attachKickoffCapNotes(dimensions, rubric, new Set(capIds));

  const changed = dimensions.some((d, i) => d.score !== before[i]);
  if (!changed && !dimensions.some((d) => d.capNote)) return result;

  const next = recalculateTotals({
    ...result,
    dimensions,
    firedCaps: enrichFiredCapEffects(result.firedCaps, dimensions),
  });
  return next;
}

/** Server-only: evidence metadata + quick-fix fallbacks. Do not import from client components. */
export function hydrateCompletedReport(
  result: EvaluationResult,
  transcript?: string | null,
): EvaluationResult {
  let next = applyKickoffMeritHydration(result, transcript);
  next = applyTranscriptAutoCaps(next, transcript);
  next = applyKickoffCloseCalibration(next, transcript);
  next = applyCoachingTranscriptRepairs(next, transcript);
  next = applyEliteBarCalibration(next, transcript);
  next = applyEvidenceScoreCaps(next);
  // Re-apply kick-off floors after evidence caps (legacy rows may lack verified counts).
  next = applyKickoffCloseCalibration(next, transcript);
  next = mergeKickoffDisclosureRedFlags(next, transcript);
  next = filterKickoffTranscriptRedFlags(next, transcript);
  next = hydrateEvaluationResult(next);
  // Re-apply kick-off caps after presentation (never raise scores).
  next = applyEliteBarCalibration(next, transcript);
  next = applyKickoffMeritHydration(next, transcript);
  next = applyKickoffCloseCalibration(next, transcript);
  next = mergeKickoffDisclosureRedFlags(next, transcript);
  next = filterKickoffTranscriptRedFlags(next, transcript);
  next = applyTranscriptAutoCaps(next, transcript);
  return {
    ...next,
    dimensions: refreshDimensionQuickFixes(
      next.dimensions,
      getRubric(next.callType),
    ),
  };
}
