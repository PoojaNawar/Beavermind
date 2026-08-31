/**
 * Final judge consistency pass: rule results ↔ evidence ↔ score ↔ feedback.
 * Runs on transcript hydration — does not blindly inflate scores.
 */

import type {
  CallType,
  DimensionResult,
  EvaluationResult,
  RedFlag,
} from "@/lib/rubrics/types";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import {
  criteriaSummary,
  eliteCriteriaAllMet,
  eliteCriteriaGaps,
  evaluateDimensionCriteria,
  repeatStrengthsFromCriteria,
  whyNotFullMarksFromCriteria,
} from "@/lib/scoring/criterionEvaluation";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";
import { rubricQuickFix } from "@/lib/scoring/dimensionAdjudication";
import { normalizeForQuoteMatch } from "@/lib/transcripts/quoteMatch";

const BOOKING_CONTRADICTION_RE =
  /\b(not booked|without booking|failed to book|next call was not booked|no live booking|deferr(?:ed|ing) to an assistant)\b/i;

const BOOKING_FLAG_RE =
  /\b(live booking|not booked|booking|calendar invite|until the end|booked (?:too )?late|no live)\b/i;

function isFullMarks(dim: DimensionResult): boolean {
  return (
    !dim.disabled &&
    !dim.notApplicable &&
    dim.score !== null &&
    dim.score >= dim.maxScore
  );
}

function isScored(dim: DimensionResult): boolean {
  return !dim.disabled && !dim.notApplicable && dim.score !== null;
}

function dedupeEvidence(dim: DimensionResult): DimensionResult {
  const seen = new Set<string>();
  const evidence = dim.evidence.filter((item) => {
    const key = normalizeForQuoteMatch(item.quote);
    if (!key || key.length < 8) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (evidence.length === dim.evidence.length) return dim;
  const verified = evidence.filter(
    (e) => e.verificationStatus === "verified" || e.demonstrated,
  ).length;
  return {
    ...dim,
    evidence,
    verifiedEvidenceCount: verified,
    evidenceFound: evidence.length > 0,
  };
}

function repairRationaleForCriteria(
  dim: DimensionResult,
  criteria: DimensionResult["criteriaResults"],
): string {
  if (!criteria?.length) return dim.rationale;

  if (isFullMarks(dim) && eliteCriteriaAllMet(criteria)) {
    const strengths = repeatStrengthsFromCriteria(criteria);
    if (strengths) {
      return `Verified transcript evidence satisfies the elite rubric rules for this dimension (${strengths}).`;
    }
  }

  const bookingRule = criteria.find((c) => c.id.includes("live-booking"));
  if (
    bookingRule?.status === "met" &&
    BOOKING_CONTRADICTION_RE.test(dim.rationale)
  ) {
    return bookingRule.note;
  }

  const gaps = eliteCriteriaGaps(criteria);
  if (gaps.length > 0 && !isFullMarks(dim)) {
    return gaps[0]!.note;
  }

  return dim.rationale;
}

function repairQuickFixForCriteria(
  dim: DimensionResult,
  callType: CallType,
  criteria: DimensionResult["criteriaResults"],
): string {
  if (isFullMarks(dim)) return FULL_MARKS_QUICK_FIX;

  const gaps = eliteCriteriaGaps(criteria ?? []);
  if (gaps.length === 0) return dim.quickFix;

  const rubricFix = rubricQuickFix(dim.id, callType);
  if (rubricFix) return rubricFix;

  const first = gaps[0]!;
  if (first.id.includes("live-booking")) {
    return "Get a verbal date and time for the next call before hanging up.";
  }
  if (first.id.includes("north-star")) {
    return "State the emotional why back, name a North Star, and confirm it with the client.";
  }
  if (first.id.includes("understanding")) {
    return "Confirm the diagnostic → film → upload workflow and deadlines out loud before ending.";
  }
  return dim.quickFix;
}

function filterContradictoryRedFlags(
  redFlags: RedFlag[],
  transcript: string,
  dimensions: DimensionResult[],
): RedFlag[] {
  const d10 = dimensions.find((d) => d.id === "d10");
  const bookingMet =
    hasLiveNextCallBooking(transcript) ||
    d10?.criteriaResults?.some(
      (c) => c.id.includes("live-booking") && c.status === "met",
    ) ||
    (d10 && isFullMarks(d10));

  return redFlags.filter((flag) => {
    const blob = `${flag.title} ${flag.explanation} ${flag.evidence}`;
    if (bookingMet && BOOKING_FLAG_RE.test(blob)) {
      return false;
    }
    if (
      /structured recap|no recap/i.test(blob) &&
      dimensions.some((d) =>
        d.criteriaResults?.some(
          (c) => c.id.includes("structured-recap") && c.status === "met",
        ),
      )
    ) {
      return false;
    }
    return true;
  });
}

function auditDimension(
  dim: DimensionResult,
  transcript: string,
  callType: CallType,
): DimensionResult {
  let next = dedupeEvidence(dim);
  const criteriaResults = evaluateDimensionCriteria(next, transcript, callType);
  next = { ...next, criteriaResults };

  if (!isScored(next) || next.score === null) return next;

  const whyFromRules = whyNotFullMarksFromCriteria(criteriaResults);

  if (isFullMarks(next)) {
    next = {
      ...next,
      whyNotFullMarks: null,
      quickFix: FULL_MARKS_QUICK_FIX,
      rationale: repairRationaleForCriteria(next, criteriaResults),
    };
    return next;
  }

  next = {
    ...next,
    whyNotFullMarks: whyFromRules ?? next.whyNotFullMarks ?? null,
    quickFix: repairQuickFixForCriteria(next, callType, criteriaResults),
    rationale: repairRationaleForCriteria(next, criteriaResults),
  };

  return next;
}

export type JudgeAuditReport = {
  criteriaChecked: number;
  inconsistencies: string[];
};

export function applyJudgeAudit(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (!transcript?.trim()) return result;

  const inconsistencies: string[] = [];
  const dimensions = result.dimensions.map((dim) => {
    const audited = auditDimension(dim, transcript, result.callType);

    if (
      isScored(audited) &&
      audited.score !== null &&
      audited.criteriaResults?.length
    ) {
      const eliteMet = eliteCriteriaAllMet(audited.criteriaResults);
      if (audited.score >= audited.maxScore && !eliteMet) {
        inconsistencies.push(
          `${audited.id}: score ${audited.score}/${audited.maxScore} but elite rules not all met (${criteriaSummary(audited.criteriaResults)})`,
        );
      }
      if (audited.score < audited.maxScore && eliteMet) {
        inconsistencies.push(
          `${audited.id}: partial score ${audited.score}/${audited.maxScore} but all elite rules met`,
        );
      }

      const bookingRule = audited.criteriaResults.find((c) =>
        c.id.includes("live-booking"),
      );
      if (
        bookingRule?.status === "met" &&
        audited.id === "d10" &&
        audited.score === 0
      ) {
        inconsistencies.push(
          "d10: score 0 contradicts live-booking rule marked met",
        );
      }
      if (
        bookingRule?.status === "met" &&
        BOOKING_CONTRADICTION_RE.test(audited.rationale)
      ) {
        inconsistencies.push(
          "d10: rationale contradicts verified live-booking rule",
        );
      }
    }

    return audited;
  });

  const redFlags = filterContradictoryRedFlags(
    result.redFlags,
    transcript,
    dimensions,
  );

  void inconsistencies;

  return { ...result, dimensions, redFlags };
}
