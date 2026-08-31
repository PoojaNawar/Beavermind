import type {
  DimensionResult,
  EvaluationResult,
  FiredCap,
  GradeBand,
  OneThing,
  Rubric,
} from "@/lib/rubrics/types";
import type { ModelEvaluationOutput } from "@/lib/validation/schemas";
import {
  normalizeStoredEvidence,
  summarizeDimensionEvidence,
  summarizeReportEvidence,
} from "@/lib/transcripts/evidenceQuality";
import { refreshDimensionQuickFixes } from "@/lib/scoring/quickFix";
import {
  applyKickoffCloseCalibration,
  filterKickoffTranscriptRedFlags,
  kickoffHasEliteClose,
  kickoffHasStructuredRecap,
  mergeKickoffDisclosureRedFlags,
} from "@/lib/scoring/kickoffClose";
import {
  floorEliteScore,
  nextEliteScore,
  repairCoachingBookingDimension,
  repairCoachingMovementDimension,
} from "@/lib/scoring/eliteBar";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import { capScoreWithoutVerifiedEvidence } from "@/lib/transcripts/evidencePolicy";
import { computeScoreIfApplied } from "@/lib/scoring/scoreIfApplied";
import { applyAutoCapsToDimensions } from "@/lib/scoring/transcriptCaps";
import {
  applyKickoffMeritScoring,
  attachKickoffCapNotes,
  enrichFiredCapEffects,
} from "@/lib/scoring/meritCaps";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function snapToDiscrete(score: number, allowed: number[]): number {
  let best = allowed[0]!;
  let bestDist = Math.abs(score - best);
  for (const a of allowed) {
    const d = Math.abs(score - a);
    if (d < bestDist) {
      best = a;
      bestDist = d;
    }
  }
  return best;
}

export function gradeFromScore(score: number, rubric: Rubric): GradeBand {
  const sorted = [...rubric.gradeBands].sort((a, b) => b.min - a.min);
  for (const band of sorted) {
    if (score >= band.min && score <= band.max) {
      return band.band;
    }
  }
  return "Fail";
}

/** Map a raw score onto the 100-point grade scale. */
export function normalizeToHundred(
  rawScore: number,
  scoreOutOf: number,
): number {
  if (scoreOutOf === 100) return Math.round(rawScore);
  return Math.round((rawScore / scoreOutOf) * 100);
}

/**
 * Backend-owned totals, caps, and grade.
 * Unverified-only Elite proposals are capped down before totals; evidence
 * strength metadata alone never raises a score.
 */
export function applyCapsAndBuildResult(args: {
  model: ModelEvaluationOutput;
  rubric: Rubric;
  modelName: string;
  transcript?: string;
}): EvaluationResult {
  const { model, rubric, modelName, transcript } = args;
  const firedCaps: FiredCap[] = [];
  const dimById = new Map(rubric.dimensions.map((d) => [d.id, d]));

  // Start from model dimension scores
  const working = model.dimensions.map((d) => {
    const def = dimById.get(d.id)!;
    let score = d.score;

    if (!d.disabled && !d.notApplicable && score !== null) {
      score = clamp(score, 0, def.maxScore);
      if (def.discreteScores?.length) {
        if (rubric.id === "coaching" || def.discreteScores.includes(score)) {
          score = snapToDiscrete(score, def.discreteScores);
        } else if (rubric.id === "kickoff" && def.discreteScores.length) {
          // Kickoff dims with preferred buckets — snap if close
          score = snapToDiscrete(score, def.discreteScores);
        }
      }
      // Kickoff half-steps: round to 0.5
      if (rubric.id === "kickoff" && def.maxScore <= 5) {
        score = Math.round(score * 2) / 2;
        score = clamp(score, 0, def.maxScore);
      } else if (rubric.id === "kickoff") {
        score = Math.round(score);
      }

      const verified = d.evidence.filter(
        (e) =>
          e.verificationStatus === "verified" ||
          (!e.verificationStatus && e.demonstrated),
      ).length;
      const unverified = d.evidence.filter(
        (e) => e.verificationStatus === "unverified",
      ).length;
      if (
        !d.notDemonstrated &&
        verified === 0 &&
        unverified > 0
      ) {
        score = capScoreWithoutVerifiedEvidence(
          score,
          def.maxScore,
          def.discreteScores,
        );
      }
    }

    return { ...d, score };
  });

  if (rubric.id === "coaching" && transcript) {
    for (let i = 0; i < working.length; i++) {
      working[i] = repairCoachingMovementDimension(working[i]!, transcript);
    }
  }

  if (rubric.id === "kickoff" && transcript) {
    applyKickoffMeritScoring(working as DimensionResult[], transcript);
  }

  // Apply dimension-level caps / forced scores from model-reported + rule IDs
  const firedIds = new Set(model.firedCapIds);
  applyAutoCapsToDimensions(
    working as DimensionResult[],
    rubric,
    firedIds,
    firedCaps,
  );

  if (rubric.id === "kickoff" && transcript) {
    attachKickoffCapNotes(working as DimensionResult[], rubric, firedIds);
  }

  // Kickoff D11: cap/restore from the transcript, not from rationale wording.
  // D7/D12 floors are applied after the result object is built.
  if (rubric.id === "kickoff" && transcript) {
    const d11 = working.find((d) => d.id === "d11");
    if (d11 && !d11.disabled && !d11.notApplicable && d11.score !== null) {
      if (kickoffHasEliteClose(transcript)) {
        d11.score = 5;
        d11.quickFix = "";
      } else if (!kickoffHasStructuredRecap(transcript) && d11.score > 3) {
        d11.score = 3;
      }
    }
  }

  if (transcript) {
    for (const d of working) {
      d.score = nextEliteScore(rubric.id, d.id, d.score, transcript);
      d.score = floorEliteScore(rubric.id, d.id, d.score, transcript);
    }
  }

  // After caps/elite bar: restore D10 when the transcript proves a live booking.
  if (rubric.id === "coaching" && transcript) {
    for (let i = 0; i < working.length; i++) {
      working[i] = repairCoachingBookingDimension(working[i]!, transcript);
    }
    // Drop a false next-call-not-booked cap once booking is restored.
    if (hasLiveNextCallBooking(transcript)) {
      for (let i = firedCaps.length - 1; i >= 0; i--) {
        if (firedCaps[i]?.id === "next-call-not-booked") firedCaps.splice(i, 1);
      }
    }
  }

  let raw = 0;
  let available = 0;
  for (const d of working) {
    const def = dimById.get(d.id)!;
    if (d.disabled || d.notApplicable) continue;
    available += def.maxScore;
    if (d.score !== null) raw += d.score;
  }

  // Coaching source text says 100 / 85, but the dimension table sums to 105 / 90.
  // We use the sum of active dimension maxima as the true denominator, then
  // normalize onto the 100-point grade scale.
  const effectiveOutOf = available || 100;

  // Apply total caps (caps are written against a 100-point call).
  let cappedRaw = raw;
  for (const cap of rubric.autoCaps) {
    if (!firedIds.has(cap.id)) continue;
    if (cap.maxTotal !== undefined) {
      const scaledCap = Math.round((cap.maxTotal / 100) * effectiveOutOf);
      if (cappedRaw > scaledCap) {
        cappedRaw = scaledCap;
      }
    }
  }

  const overallScore = normalizeToHundred(cappedRaw, effectiveOutOf);
  const grade = gradeFromScore(overallScore, rubric);

  const dimensions: DimensionResult[] = refreshDimensionQuickFixes(
    working.map((d) => {
      const def = dimById.get(d.id)!;
      const evidence = d.evidence.map(normalizeStoredEvidence);
      const quality = summarizeDimensionEvidence(evidence, d.notDemonstrated);
      return {
        id: d.id,
        name: def.name,
        score: d.score,
        maxScore: def.maxScore,
        disabled: d.disabled,
        disabledReason: d.disabledReason,
        notApplicable: d.notApplicable,
        notApplicableReason: d.notApplicableReason,
        band: d.band,
        rationale: d.rationale,
        evidence,
        quickFix: d.quickFix,
        meritScore: (d as DimensionResult).meritScore ?? null,
        capNote: (d as DimensionResult).capNote ?? null,
        ...quality,
      };
    }),
    rubric,
  );

  let scoreIfApplied: number | null = null;
  let basis = model.oneThing.scoreIfAppliedBasis;
  if (
    model.oneThing.estimatedPointsGained !== null &&
    model.oneThing.estimatedPointsGained >= 0
  ) {
    const gained = model.oneThing.estimatedPointsGained;
    const projectedRaw = Math.min(effectiveOutOf, cappedRaw + gained);
    scoreIfApplied = normalizeToHundred(projectedRaw, effectiveOutOf);
  }

  const oneThing: OneThing = {
    recommendation: model.oneThing.recommendation,
    impact: model.oneThing.impact,
    scoreIfApplied,
    scoreIfAppliedBasis: basis,
  };

  const draft: EvaluationResult = {
    callType: rubric.id,
    rubricVersion: rubric.version,
    overallScore,
    scoreOutOf: effectiveOutOf,
    grade,
    oneThing,
    brief: model.brief,
    redFlags: model.redFlags,
    dimensions,
    firedCaps: enrichFiredCapEffects(firedCaps, dimensions),
    modelName,
    evidenceQuality: summarizeReportEvidence(dimensions),
  };

  // Backend projection replaces the model's point-gain guess.
  const projection = computeScoreIfApplied(draft);
  let finalized: EvaluationResult = {
    ...draft,
    oneThing: {
      ...draft.oneThing,
      scoreIfApplied: projection.scoreIfApplied,
      scoreIfAppliedBasis: projection.scoreIfAppliedBasis,
    },
  };

  if (transcript && rubric.id === "kickoff") {
    finalized = applyKickoffCloseCalibration(finalized, transcript);
    finalized = mergeKickoffDisclosureRedFlags(finalized, transcript);
    finalized = filterKickoffTranscriptRedFlags(finalized, transcript);
    const again = computeScoreIfApplied(finalized);
    finalized = {
      ...finalized,
      oneThing: {
        ...finalized.oneThing,
        scoreIfApplied: again.scoreIfApplied,
        scoreIfAppliedBasis: again.scoreIfAppliedBasis,
      },
    };
  }

  return finalized;
}

/** Pure helpers for tests */
export function sumDimensionScores(
  scores: { score: number | null; disabled?: boolean; notApplicable?: boolean }[],
): number {
  return scores.reduce((acc, s) => {
    if (s.disabled || s.notApplicable || s.score === null) return acc;
    return acc + s.score;
  }, 0);
}
