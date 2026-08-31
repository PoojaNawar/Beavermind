/**
 * Transcript-grounded auto-cap application for live scoring and hydration.
 * Ensures deterministic caps (e.g. no-north-star) apply even when the model
 * omits them or stored rows were scored before cap merge.
 */

import { getRubric } from "@/lib/rubrics";
import type {
  DimensionResult,
  EvaluationResult,
  FiredCap,
  Rubric,
} from "@/lib/rubrics/types";
import { gradeFromScore, normalizeToHundred } from "@/lib/scoring/calculate";
import { resolveFiredCapIds } from "@/lib/scoring/detectCaps";

function recalculateTotals(result: EvaluationResult): EvaluationResult {
  let raw = 0;
  let available = 0;
  for (const d of result.dimensions) {
    if (d.disabled || d.notApplicable || d.score === null) continue;
    available += d.maxScore;
    raw += d.score;
  }
  const scoreOutOf = available || result.scoreOutOf;
  let cappedRaw = raw;
  for (const cap of result.firedCaps) {
    const match = cap.effect.match(/Total capped at (\d+)/i);
    if (!match) continue;
    const scaledCap = Math.round((Number(match[1]) / 100) * scoreOutOf);
    if (cappedRaw > scaledCap) cappedRaw = scaledCap;
  }
  const overallScore = normalizeToHundred(cappedRaw, scoreOutOf);
  return {
    ...result,
    scoreOutOf,
    overallScore,
    grade: gradeFromScore(overallScore, getRubric(result.callType)),
  };
}

/** Apply rubric autoCaps for the given cap IDs. Mutates working scores and firedCaps. */
export function applyAutoCapsToDimensions(
  dimensions: DimensionResult[],
  rubric: Rubric,
  capIds: Iterable<string>,
  firedCaps: FiredCap[],
): boolean {
  const capIdSet = new Set(capIds);
  let changed = false;

  for (const cap of rubric.autoCaps) {
    if (!capIdSet.has(cap.id)) continue;
    const alreadyFired = firedCaps.some((c) => c.id === cap.id);

    if (cap.dimensionId && cap.forceDimensionScore !== undefined) {
      const dim = dimensions.find((d) => d.id === cap.dimensionId);
      if (dim && !dim.disabled && !dim.notApplicable) {
        if (dim.score !== cap.forceDimensionScore) {
          dim.score = cap.forceDimensionScore;
          changed = true;
        }
        if (!alreadyFired) {
          firedCaps.push({
            id: cap.id,
            condition: cap.condition,
            effect: `${cap.dimensionId} forced to ${cap.forceDimensionScore}`,
          });
          changed = true;
        }
      }
    } else if (cap.dimensionId && cap.maxDimensionScore !== undefined) {
      const dim = dimensions.find((d) => d.id === cap.dimensionId);
      if (
        dim &&
        !dim.disabled &&
        !dim.notApplicable &&
        dim.score !== null
      ) {
        if (dim.score > cap.maxDimensionScore) {
          dim.score = cap.maxDimensionScore;
          changed = true;
        }
        if (!alreadyFired) {
          firedCaps.push({
            id: cap.id,
            condition: cap.condition,
            effect: `${cap.dimensionId} capped at ${cap.maxDimensionScore}`,
          });
          changed = true;
        }
      }
    } else if (cap.maxTotal !== undefined && !alreadyFired) {
      firedCaps.push({
        id: cap.id,
        condition: cap.condition,
        effect: `Total capped at ${cap.maxTotal}`,
      });
      changed = true;
    }
  }

  return changed;
}

/** Reconcile transcript caps on a stored or hydrated evaluation result. */
export function applyTranscriptAutoCaps(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (!transcript?.trim()) return result;

  const rubric = getRubric(result.callType);
  const capIds = resolveFiredCapIds({
    callType: result.callType,
    transcript,
    modelFiredIds: result.firedCaps.map((c) => c.id),
  });

  const dimensions = result.dimensions.map((d) => ({ ...d }));
  const firedCaps = [...result.firedCaps];
  const changed = applyAutoCapsToDimensions(
    dimensions,
    rubric,
    capIds,
    firedCaps,
  );

  if (!changed) return result;
  return recalculateTotals({ ...result, dimensions, firedCaps });
}
