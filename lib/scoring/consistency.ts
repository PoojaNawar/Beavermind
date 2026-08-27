import type {
  CallType,
  DimensionResult,
  EvaluationResult,
  GradeBand,
  RedFlag,
} from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";

/**
 * Pre-render consistency repair + light adjudication.
 * Client-safe: no fs / getRubric imports.
 *
 * When score and rationale conflict at full marks, decide using verified
 * dimension evidence (and known elite heuristics) — never blindly force
 * the prose to match an unsupported score, and never invent evidence.
 */

const INTERNAL_DIM_ID = /\b[dD](1[0-2]|[1-9])\b/g;

function hideInternalIds(text: string): string {
  return text
    .replace(INTERNAL_DIM_ID, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export type ConsistencyReport = {
  score_consistent: boolean;
  rationale_consistent: boolean;
  evidence_consistent: boolean;
  quick_fix_consistent: boolean;
  red_flags_consistent: boolean;
  summary_consistent: boolean;
  na_consistent: boolean;
  projection_consistent: boolean;
  formatting_valid: boolean;
  repairs: string[];
};

const DEFICIENCY_RE =
  /\b(did not|didn't|does not|doesn't|failed to|lacked|missing|without|could have|should have|needs? improvement|not fully|necessary for a higher score|for a higher score|prevented full|held .+ back|weak(?:ness|er)?|incomplete|unclear)\b/i;

const BOOKING_FLAG_RE =
  /\b(live booking|not booked|booking|calendar invite|until the end|booked (?:too )?late|no live)\b/i;

const OPPORTUNITY_AS_FLAG_RE =
  /\b(could (?:have|be) better|nice to have|opportunity|consider|prefer(?:ably)?)\b/i;

const LIVE_BOOKING_EVIDENCE_RE =
  /calendar invite|sending (?:you )?(?:the )?invite|book(?:ed|ing)? (?:it |the next call )?live|while we(?:'re| are) still on|lock(?:ed)? (?:in )?(?:for )?(?:tuesday|wednesday|thursday|friday|monday)/i;

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

export function hasDeficiencyLanguage(text: string): boolean {
  return DEFICIENCY_RE.test(text);
}

function verifiedBlob(dim: DimensionResult): string {
  return dim.evidence
    .filter((e) => e.verificationStatus === "verified")
    .map((e) => `${e.speaker ?? ""}: ${e.quote}`)
    .join("\n");
}

/** Strong/mid snap when Elite is unsupported. Mirrors discrete bands used in rubrics. */
export function strongBandBelowMax(maxScore: number): number {
  if (maxScore === 5) return 3;
  if (maxScore === 15) return 10;
  if (maxScore === 10) return 7;
  return Math.max(0, Math.round(maxScore * 0.7));
}

/**
 * Whether verified quotes on this dimension support Elite / full credit.
 * Returns null when there is not enough verified text to decide.
 */
export function evidenceSupportsFullMarks(
  dim: DimensionResult,
  callType: CallType,
): boolean | null {
  const text = verifiedBlob(dim);
  if (text.trim().length < 12) {
    if (dim.verifiedEvidenceCount === 0) return false;
    return null;
  }

  if (callType === "kickoff" && dim.id === "d3") {
    const time =
      /\b\d{1,3}\s*(?:min(?:ute)?s?)\b/i.test(text) ||
      /\b(?:fifteen|twenty(?:[- ]five)?|thirty(?:[- ]five)?|forty(?:[- ]five)?|forty|sixty)\s+minutes?\b/i.test(
        text,
      ) ||
      /minutes together|about .{0,20}minutes/i.test(text);
    const thenCount = (text.match(/\bthen\b/gi) || []).length;
    const sequenced =
      (/first/i.test(text) && thenCount >= 2) ||
      (/(?:first|1[.\)\:]|phase\s*one)/i.test(text) &&
        /(?:second|2[.\)\:]|phase\s*two)/i.test(text) &&
        /(?:third|3[.\)\:]|phase\s*three|finally|last)/i.test(text)) ||
      (thenCount >= 2 &&
        /agenda|shape of it|today we(?:'ll| will)|walk (?:you )?through|three phases|get into it/i.test(
          text,
        ));
    const consent =
      /(?:does that (?:work|sound)|sound(?:s)? (?:good|ok|okay)|work for you|shall we)/i.test(
        text,
      ) ||
      /\b(?:sounds good|that works|perfect|yes[,.]? that|let'?s (?:do|go))\b/i.test(
        text,
      );
    return time && sequenced && consent;
  }

  if (dim.id === "d10") {
    return LIVE_BOOKING_EVIDENCE_RE.test(text);
  }

  if (callType === "kickoff" && dim.id === "d5") {
    const phases =
      /retrain/i.test(text) && /remodel/i.test(text) && /integrat/i.test(text);
    const goalTie =
      /(?:your|for you|goal|north star|belay|golf|swing)/i.test(text);
    return phases && goalTie;
  }

  if (callType === "kickoff" && dim.id === "d7") {
    const channel = /messag|app|email|chat/i.test(text);
    const response = /same day|next morning|daily|get back|response/i.test(text);
    const community = /community|group space/i.test(text);
    return channel && (response || community);
  }

  if (callType === "kickoff" && dim.id === "d12") {
    return /i(?:'ll| will) (?:build|send|look|review)|weekend|monday|program/i.test(
      text,
    );
  }

  // Generic: verified support present is enough to keep full marks when
  // we cannot apply a dimension-specific elite check.
  return dim.verifiedEvidenceCount > 0 ? true : false;
}

function gapQuickFix(dim: DimensionResult, callType: CallType): string {
  if (callType === "kickoff" && dim.id === "d3") {
    return "State the time, list three sequenced phases, and get an explicit yes before diving in.";
  }
  if (dim.id === "d10") {
    return "Book the next call live with a confirmed date and time before ending the session.";
  }
  if (callType === "kickoff" && dim.id === "d5") {
    return "For each phase, say what it does, the expected outcome, and how it serves this client's goal.";
  }
  return `Demonstrate the missing elite behaviour for ${dim.name} with verified client confirmation.`;
}

function fullMarkRationale(dim: DimensionResult): string {
  const verified = dim.verifiedEvidenceCount;
  const rejected = dim.rejectedEvidenceCount;
  if (verified > 0 && rejected > 0) {
    return `Verified evidence shows ${dim.name.toLowerCase()} fully satisfied the rubric for this call. Unverified proposed quotes were not used as support.`;
  }
  if (verified > 0) {
    return `Verified transcript evidence shows ${dim.name.toLowerCase()} fully satisfied the rubric criteria for this call.`;
  }
  return `${dim.name} reached full marks under the rubric for this call.`;
}

function normalizeHundred(raw: number, available: number): number {
  if (available <= 0) return 0;
  if (available === 100) return Math.round(raw);
  return Math.round((raw / available) * 100);
}

function gradeFromHundred(score: number): GradeBand {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Inconsistent";
  if (score >= 60) return "At risk";
  return "Fail";
}

export function recalculateTotals(result: EvaluationResult): EvaluationResult {
  let raw = 0;
  let available = 0;
  for (const d of result.dimensions) {
    if (d.disabled || d.notApplicable || d.score === null) continue;
    available += d.maxScore;
    raw += d.score;
  }
  const scoreOutOf = available || result.scoreOutOf;
  const overallScore = normalizeHundred(raw, scoreOutOf);
  return {
    ...result,
    scoreOutOf,
    overallScore,
    grade: gradeFromHundred(overallScore),
  };
}

/**
 * Resolve full-mark ↔ deficiency contradictions using verified evidence.
 */
export function adjudicateFullMarkContradiction(
  dim: DimensionResult,
  callType: CallType,
): { dim: DimensionResult; repairs: string[] } {
  const repairs: string[] = [];
  if (!isFullMarks(dim) || !hasDeficiencyLanguage(dim.rationale)) {
    return { dim, repairs };
  }

  const support = evidenceSupportsFullMarks(dim, callType);

  if (support === true) {
    return {
      dim: {
        ...dim,
        rationale: fullMarkRationale(dim),
        quickFix: FULL_MARKS_QUICK_FIX,
      },
      repairs: [
        `${dim.id}: score kept — verified evidence supports full marks; rationale repaired`,
      ],
    };
  }

  if (support === false) {
    const nextScore = strongBandBelowMax(dim.maxScore);
    return {
      dim: {
        ...dim,
        score: nextScore,
        rationale: hideInternalIds(dim.rationale.trim()),
        quickFix: gapQuickFix(dim, callType),
      },
      repairs: [
        `${dim.id}: score lowered to ${nextScore}/${dim.maxScore} — verified evidence does not support full marks; rationale gap retained`,
      ],
    };
  }

  // Ambiguous evidence: do not invent a deduction. Align narrative to score.
  return {
    dim: {
      ...dim,
      rationale: fullMarkRationale(dim),
      quickFix: FULL_MARKS_QUICK_FIX,
    },
    repairs: [
      `${dim.id}: ambiguous evidence — kept score and repaired contradictory rationale`,
    ],
  };
}

export function repairDimensionConsistency(
  dim: DimensionResult,
  callType: CallType = "kickoff",
): { dim: DimensionResult; repairs: string[] } {
  const repairs: string[] = [];
  if (!isScored(dim)) {
    return {
      dim: {
        ...dim,
        rationale: hideInternalIds(dim.rationale),
        quickFix: "",
      },
      repairs,
    };
  }

  if (isFullMarks(dim) && hasDeficiencyLanguage(dim.rationale)) {
    return adjudicateFullMarkContradiction(dim, callType);
  }

  let rationale = hideInternalIds(dim.rationale.trim());
  let quickFix = dim.quickFix;
  let score = dim.score;

  if (isFullMarks(dim)) {
    if (
      dim.rejectedEvidenceCount > 0 &&
      dim.verifiedEvidenceCount > 0 &&
      !/unverified/i.test(rationale)
    ) {
      rationale = fullMarkRationale(dim);
      repairs.push(`${dim.id}: clarified unverified quotes were not used`);
    }

    // Full marks with zero verified support: lower when we can prove elite fails.
    if (dim.verifiedEvidenceCount === 0 && dim.rejectedEvidenceCount > 0) {
      const support = evidenceSupportsFullMarks(dim, callType);
      if (support === false) {
        score = strongBandBelowMax(dim.maxScore);
        quickFix = gapQuickFix(dim, callType);
        rationale =
          "The transcript does not provide sufficient verified evidence for full marks on this dimension.";
        repairs.push(
          `${dim.id}: full marks without verified evidence — score lowered to ${score}/${dim.maxScore}`,
        );
        return {
          dim: { ...dim, score, rationale, quickFix },
          repairs,
        };
      }
    }

    if (quickFix !== FULL_MARKS_QUICK_FIX && quickFix.trim() !== "") {
      repairs.push(`${dim.id}: full-mark quick fix normalized`);
    }
    quickFix = FULL_MARKS_QUICK_FIX;
  }

  return {
    dim: {
      ...dim,
      score,
      rationale,
      quickFix,
    },
    repairs,
  };
}

function bookingSatisfied(result: EvaluationResult): boolean {
  const booking =
    result.dimensions.find((d) => d.id === "d10") ??
    result.dimensions.find((d) =>
      /booking next call|next call booking/i.test(d.name),
    );
  if (!booking || booking.score === null) return false;
  if (booking.score < booking.maxScore) return false;
  const text = verifiedBlob(booking);
  if (text && LIVE_BOOKING_EVIDENCE_RE.test(text)) return true;
  // Score already full — treat as satisfied unless verified text actively contradicts.
  return true;
}

function redFlagHasEvidence(flag: RedFlag): boolean {
  const ev = (flag.evidence || "").trim();
  if (ev.length < 8) return false;
  if (/^(n\/?a|none|null|undefined|-)$/i.test(ev)) return false;
  return true;
}

export function filterConsistentRedFlags(
  result: EvaluationResult,
): { redFlags: RedFlag[]; repairs: string[] } {
  const repairs: string[] = [];
  const bookingOk = bookingSatisfied(result);
  const d11 = result.dimensions.find((d) => d.id === "d11");
  const recapLikely =
    result.callType === "kickoff" &&
    Boolean(
      d11 &&
        d11.score !== null &&
        (d11.score >= 3 ||
          /recap|upload by|videos uploaded|next steps/i.test(
            verifiedBlob(d11),
          )),
    );

  const redFlags = result.redFlags
    .filter((flag) => {
      const blob = `${flag.title} ${flag.explanation} ${flag.evidence}`;
      const cleaned = {
        title: hideInternalIds(flag.title),
        explanation: hideInternalIds(flag.explanation),
        evidence: hideInternalIds(flag.evidence),
      };

      if (bookingOk && BOOKING_FLAG_RE.test(blob)) {
        repairs.push("red flag removed: contradicts verified live booking");
        return false;
      }

      if (
        recapLikely &&
        /(?:no |missing |without (?:a )?)(?:structured )?recap/i.test(blob)
      ) {
        repairs.push("red flag removed: contradicts structured recap evidence");
        return false;
      }

      if (
        /north star/i.test(blob) &&
        /(?:missing|no north|never established|not constructed)/i.test(blob) &&
        !/risk|retention|abandon|confused|unsafe/i.test(blob)
      ) {
        repairs.push(
          "red flag removed: North Star miss is a scoring cap, not a red flag",
        );
        return false;
      }

      if (!redFlagHasEvidence(cleaned)) {
        repairs.push(`red flag removed: no verified evidence (${cleaned.title})`);
        return false;
      }

      if (
        OPPORTUNITY_AS_FLAG_RE.test(blob) &&
        !/risk|retention|abandon|confused|unsafe/i.test(blob)
      ) {
        repairs.push(`red flag removed: opportunity language (${cleaned.title})`);
        return false;
      }

      const allFull = result.dimensions.filter(isScored).every(isFullMarks);
      if (
        allFull &&
        !/risk|retention|abandon|confused|hostile|unsafe/i.test(blob)
      ) {
        repairs.push(
          `red flag removed: no scored gap to support (${cleaned.title})`,
        );
        return false;
      }

      return true;
    })
    .map((flag) => ({
      title: hideInternalIds(flag.title),
      explanation: hideInternalIds(flag.explanation),
      evidence: hideInternalIds(flag.evidence),
    }));

  return { redFlags, repairs };
}

export function actionOneThingForDimension(
  dim: DimensionResult,
  callType: string,
): { recommendation: string; impact: string } {
  if (callType === "kickoff") {
    if (dim.id === "d9") {
      return {
        recommendation: "Close the loop on next steps.",
        impact:
          "Make sure the client knows exactly what to do, where to do it, by when, and can confirm the workflow before the call ends.",
      };
    }
    if (dim.id === "d6") {
      return {
        recommendation: "Set the journey and expectations clearly.",
        impact:
          "When the client understands the path and what to expect in the hard weeks, confidence and retention both improve.",
      };
    }
    if (dim.id === "d1") {
      return {
        recommendation: "Make prep visible in the first minutes.",
        impact:
          "Naming specific intake details early proves the coach arrived prepared and builds immediate trust.",
      };
    }
    if (dim.id === "d3") {
      return {
        recommendation: "Frame the agenda and get consent upfront.",
        impact:
          "Stating time, sequencing the phases, and getting a clear yes keeps the call structured and client-owned.",
      };
    }
    if (dim.id === "d4") {
      return {
        recommendation: "Lock the North Star and a 30-day marker.",
        impact:
          "When the emotional why is named, confirmed, and tied to a near-term marker, the rest of the program has something concrete to serve.",
      };
    }
    if (dim.id === "d11") {
      return {
        recommendation: "Close with an emotionally anchored recap.",
        impact:
          "A specific recap that reconnects to the goal leaves the client clear and confident as the call ends.",
      };
    }
  }

  if (callType === "coaching") {
    if (dim.id === "d10") {
      return {
        recommendation: "Book the next call before the session ends.",
        impact:
          "Choosing a date and time live, confirming it out loud, and sending the invite before hanging up removes ambiguity.",
      };
    }
    if (dim.id === "d6" || dim.id === "d7" || dim.id === "d11") {
      return {
        recommendation: "Close the loop on accountability and continuity.",
        impact:
          "Clear ownership, deadlines, and follow-up make continuity between sessions reliable.",
      };
    }
  }

  return {
    recommendation: `Strengthen ${dim.name.toLowerCase()}.`,
    impact:
      "This was the largest meaningful score gap on this evaluation, and closing it would most improve the client experience.",
  };
}

export function emptyConsistencyReport(): ConsistencyReport {
  return {
    score_consistent: true,
    rationale_consistent: true,
    evidence_consistent: true,
    quick_fix_consistent: true,
    red_flags_consistent: true,
    summary_consistent: true,
    na_consistent: true,
    projection_consistent: true,
    formatting_valid: true,
    repairs: [],
  };
}

/**
 * Repair contradictory narrative before the report is shown.
 * May lower an unsupported full-mark score when verified evidence proves
 * the elite bar was not met. Never raises scores. Never changes rubric weights.
 */
export function repairEvaluationConsistency(
  result: EvaluationResult,
): { result: EvaluationResult; report: ConsistencyReport } {
  const report = emptyConsistencyReport();
  const dimOut: DimensionResult[] = [];
  let scoresChanged = false;

  for (const dim of result.dimensions) {
    const before = dim.score;
    const { dim: next, repairs } = repairDimensionConsistency(
      dim,
      result.callType,
    );
    if (repairs.length) {
      report.repairs.push(...repairs);
      if (repairs.some((r) => /rationale|quick fix|clarified|ambiguous/i.test(r))) {
        report.rationale_consistent = false;
        report.quick_fix_consistent = false;
      }
      if (repairs.some((r) => /score lowered|score kept/i.test(r))) {
        report.score_consistent = false;
      }
    }
    if (next.score !== before) scoresChanged = true;
    if (
      isFullMarks(next) &&
      next.rejectedEvidenceCount > 0 &&
      next.verifiedEvidenceCount === 0
    ) {
      report.evidence_consistent = false;
      report.repairs.push(`${next.id}: full marks with no verified quotes`);
    }
    dimOut.push(next);
  }

  let withDims: EvaluationResult = { ...result, dimensions: dimOut };
  if (scoresChanged) {
    withDims = recalculateTotals(withDims);
    report.repairs.push("overall score recalculated after dimension adjudication");
  }

  const { redFlags, repairs: flagRepairs } = filterConsistentRedFlags(withDims);
  if (flagRepairs.length) {
    report.red_flags_consistent = false;
    report.repairs.push(...flagRepairs);
  }

  // Projection must not claim a lower score than current after repairs.
  let oneThing = {
    ...result.oneThing,
    recommendation: hideInternalIds(result.oneThing.recommendation),
    impact: hideInternalIds(result.oneThing.impact),
    scoreIfAppliedBasis: hideInternalIds(result.oneThing.scoreIfAppliedBasis),
  };
  if (
    oneThing.scoreIfApplied !== null &&
    oneThing.scoreIfApplied <= withDims.overallScore
  ) {
    oneThing = {
      ...oneThing,
      scoreIfApplied: null,
      scoreIfAppliedBasis:
        "The projected total would not rise under the current rubric constraints.",
    };
    report.projection_consistent = false;
    report.repairs.push("projection cleared — not above current overall score");
  }

  const repaired: EvaluationResult = {
    ...withDims,
    redFlags,
    brief: hideInternalIds(result.brief),
    oneThing,
  };

  if (report.repairs.length === 0) {
    return { result: repaired, report };
  }

  return {
    result: repaired,
    report: {
      ...report,
      score_consistent: true,
      rationale_consistent: true,
      evidence_consistent: true,
      quick_fix_consistent: true,
      red_flags_consistent: true,
      summary_consistent: true,
      na_consistent: true,
      projection_consistent: true,
      formatting_valid: true,
    },
  };
}
