/**
 * Rubric-grounded dimension adjudication: whyNotFullMarks, evidence hygiene,
 * and partial-score language. Scoring decisions drive feedback — not the reverse.
 */

import type { CallType, DimensionResult, EvaluationResult } from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";

const INTERNAL_DIM_ID = /\b[dD](1[0-2]|[1-9])\b/g;

function hideInternalIds(text: string): string {
  return text
    .replace(INTERNAL_DIM_ID, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export type PerformanceLevel =
  | "full"
  | "minor_opportunity"
  | "small_opportunity"
  | "meaningful_opportunity"
  | "significant_gap"
  | "critical_miss";

function isScored(dim: DimensionResult): boolean {
  return !dim.disabled && !dim.notApplicable && dim.score !== null;
}

export function isFullMarks(dim: DimensionResult): boolean {
  return isScored(dim) && dim.score !== null && dim.score >= dim.maxScore;
}

/** Detect accidental mid-word clipping from excerpt extraction. */
export function isBrokenEvidenceQuote(quote: string): boolean {
  const q = quote.trim();
  if (q.length < 16) return false;
  if (/^re we actually/i.test(q)) return true;
  if (/^[a-z]{1,4}\s+(?:we|i|you|the|a)\s/i.test(q) && !/^[A-Z"']/.test(q)) {
    return true;
  }
  if (/^\w+\s*—\s*[a-z]/.test(q) && !/^[A-Z]/.test(q)) return true;
  return false;
}

export function performanceLevel(
  dim: DimensionResult,
  result?: EvaluationResult,
): PerformanceLevel {
  if (!isScored(dim) || dim.score === null) return "full";
  if (dim.score >= dim.maxScore) return "full";

  const gap = dim.maxScore - dim.score;
  const ratio = dim.score / dim.maxScore;

  if (dim.score === 0) {
    const forced =
      result?.firedCaps.some(
        (c) =>
          (c.id === "next-call-not-booked" && dim.id === "d10") ||
          (c.id === "struggle-ignored" && dim.id === "d8"),
      ) ?? false;
    if (forced) return "critical_miss";
  }

  if (gap <= 1 && ratio >= 0.85) return "minor_opportunity";
  if (gap <= 2 && ratio >= 0.75) return "small_opportunity";
  if (gap <= 3 || ratio >= 0.6) return "meaningful_opportunity";
  if (ratio >= 0.4) return "significant_gap";
  return "critical_miss";
}

export function performanceLevelLabel(level: PerformanceLevel): string | null {
  switch (level) {
    case "full":
      return null;
    case "minor_opportunity":
      return "MINOR OPPORTUNITY";
    case "small_opportunity":
      return "OPPORTUNITY";
    case "meaningful_opportunity":
      return "OPPORTUNITY";
    case "significant_gap":
      return "SIGNIFICANT GAP";
    case "critical_miss":
      return "CRITICAL";
  }
}

const KICKOFF_QUICK_FIX: Record<string, string> = {
  d1: "Name two intake details (goals, injury, or history) in the first minutes so prep is obvious.",
  d2: "Share a brief, relevant personal experience that mirrors the client's situation, then connect it back to what the client is feeling.",
  d3: "State the time, list three sequenced phases, and get a yes before diving in.",
  d4: "State the emotional why back to the client, name it as the North Star, and confirm a concrete 30-day marker they agree to.",
  d5: "For each phase, say what it does, the expected outcome, and how it serves this client's specific goal.",
  d6: "Name the valleys ahead and separate good pain from bad pain so they are emotionally ready.",
  d7: "Spell out channel, response time, community, and how they will be held accountable.",
  d8: "Ask a behavioral and a self-awareness question, then change the plan from the answer.",
  d9: "Explain what the client needs to record, where it should be uploaded, and the deadline. Confirm that the client understands the sequence before ending the call.",
  d10: "Get a verbal date and time for the next call before hanging up.",
  d11: "Close with a structured recap and an emotional confidence anchor, not only logistics.",
  d12: "Commit to specific post-call deliverables with precise deadlines.",
};

const COACHING_QUICK_FIX: Record<string, string> = {
  d1: "Open with body check-in, a genuine win or struggle, and a clear intention for the session.",
  d3: "Name the current block, reconnect it to the long-term vision, and confirm how today's work serves that outcome.",
  d4: "Coach movement live on camera with cues, reps, and a reflective question tied to the goal.",
  d5: "Frame the adjustment as strategy that protects the long game, and check that the client understands why it is the right move now.",
  d6: "Leave with specific commitments, owners, deadlines, client confirmation, and a miss consequence.",
  d7: "Set one clear accountability anchor with a consequence.",
  d8: "Coach through the struggle live instead of moving past it.",
  d9: "Close with a clear recap and confirmed next step.",
  d10: "Book the next call before the session ends.",
  d11: "Restate continuity and coach follow-up with timing.",
  d12: "Keep session structure explicit from open to close.",
};

function rubricQuickFix(dimId: string, callType: CallType): string | null {
  const map = callType === "kickoff" ? KICKOFF_QUICK_FIX : COACHING_QUICK_FIX;
  return map[dimId]?.trim() || null;
}

/** Rubric-grounded gap text when score < max. Null when no defensible gap. */
export function computeWhyNotFullMarks(
  dim: DimensionResult,
  callType: CallType,
): string | null {
  if (!isScored(dim) || dim.score === null || isFullMarks(dim)) return null;

  const gap = dim.maxScore - dim.score;

  if (callType === "kickoff") {
    switch (dim.id) {
      case "d1":
        if (gap <= 1) {
          return "The rubric requires fully reviewed intake with specific goals, injuries, and at least two CRM details surfaced in the first minutes; prep was visible but one elite signal was not fully demonstrated in verified evidence.";
        }
        return "The rubric requires clear pre-call preparation with specific intake details early; the transcript does not fully demonstrate that bar.";
      case "d2":
        return "The rubric requires warm, personalized rapport with a relevant personal share that demonstrates understanding, returns focus to the client, and helps the client open up; one of those elite signals was not fully demonstrated.";
      case "d3":
        return "The rubric requires stated time, at least three sequenced phases, and explicit client consent before diving in; one of those elements was incomplete.";
      case "d4":
        return "The rubric requires the emotional why to be identified, stated back, confirmed, named as a North Star, and locked to a concrete 30-day marker; one of those elements was missing or not confirmed.";
      case "d5":
        return "The rubric requires each phase to have a clear job, outcome, and tie to this client's goal — not just phase names; one phase outcome or goal tie was not fully demonstrated.";
      case "d6":
        return "The rubric requires milestones, emotional friction, week 3–4 valleys, good-versus-bad pain, and the first month being foundational not transformational; one item was missing.";
      case "d7":
        return "The rubric requires channels, response time, community, and accountability framing to be clear in-call; one support element was incomplete.";
      case "d8":
        return "The rubric requires behavioral pattern exploration, consistency triggers, and personalization from the answers; depth or adaptation was incomplete.";
      case "d9":
        return "The rubric requires what, how, where to submit, by when, and verified client understanding; how-to or confirmed understanding was not fully demonstrated across the complete call sequence.";
      case "d10":
        return "The rubric requires a live verbal date and time confirmation before hang-up; booking was attempted or referenced but not fully secured live.";
      case "d11":
        return "The rubric requires a structured recap plus confidence anchor and emotional reinforcement; one close element was missing.";
      case "d12":
        return "The rubric requires multiple explicit in-call post-call commitments with precise deadlines; timing or commitment count did not fully reach the elite bar.";
    }
  }

  if (callType === "coaching") {
    switch (dim.id) {
      case "d1":
        return "The rubric requires body check-in, win/struggle exploration, and a reflected intention for the call; one check-in element was incomplete.";
      case "d3":
        return "The rubric requires the current block, long-term vision, and identity to be named, reflected, confirmed, and used as a North Star; vision or confirmation was incomplete.";
      case "d6":
        return "The rubric requires specific commitments, owners, deadlines, client confirmation, and a miss consequence; one accountability element was missing.";
      case "d7":
        return "The rubric requires a single client-owned deliverable with confirmation and consequence; one anchor element was missing.";
      case "d10":
        return "The rubric requires the next call to be booked live with a confirmed date and time; that did not occur before hang-up.";
    }
  }

  return `The rubric's elite criteria for ${dim.name.toLowerCase()} were not fully satisfied in verified transcript evidence.`;
}

export function heldBackPhrase(dim: DimensionResult, callType: CallType): string {
  const why = dim.whyNotFullMarks ?? computeWhyNotFullMarks(dim, callType);
  const level = performanceLevel(dim);
  const area = dim.name.replace(/\s*&\s*/g, " and ").toLowerCase();

  switch (level) {
    case "minor_opportunity":
      return `The only remaining opportunity is a minor refinement in ${area}: ${why ?? "one elite rubric signal was not fully demonstrated."}`;
    case "small_opportunity":
      return `A small opportunity remains in ${area}: ${why ?? "verified evidence did not fully satisfy the elite bar."}`;
    case "meaningful_opportunity":
      return `A meaningful opportunity remains in ${area}: ${why ?? "verified evidence did not fully satisfy the elite bar."}`;
    case "significant_gap":
      return `A significant gap in ${area}: ${why ?? "core rubric criteria were not fully demonstrated."}`;
    case "critical_miss":
      return `Critical miss in ${area}: ${why ?? "a required rubric behaviour was not demonstrated in the transcript."}`;
    default:
      return why ?? `Gap in ${area}.`;
  }
}

function quickFixContradictsEvidence(
  dim: DimensionResult,
  quickFix: string,
): boolean {
  const qf = quickFix.toLowerCase();
  const blob = dim.evidence
    .filter((e) => e.verificationStatus === "verified" || e.demonstrated)
    .map((e) => e.quote)
    .join(" ")
    .toLowerCase();

  if (!blob.trim() || !qf.trim()) return false;

  const pairs: Array<[RegExp, RegExp]> = [
    [/reference two specific intake|surface prep|intake details early/i, /forty|architect|portland|intake|PT|shoulder|back/i],
    [/confirm the workflow|confirm understanding|repeat.back/i, /basically everything|does all of that track|got it|that works/i],
    [/state the time.*three sequenced|agenda.*consent/i, /forty-five minutes|shape of it|sound good|that works/i],
    [/three timed commitments|post-call deliverables/i, /assigning your diagnostics|recap message|program.*loaded|ready.*by/i],
  ];

  return pairs.some(([fixRe, evRe]) => fixRe.test(qf) && evRe.test(blob));
}

/** Remove broken clipped quotes; keep verified items only when clean. */
export function sanitizeDimensionEvidence(
  dim: DimensionResult,
): DimensionResult {
  const evidence = dim.evidence.filter((item) => {
    if (item.verificationStatus === "not_demonstrated") return true;
    return !isBrokenEvidenceQuote(item.quote);
  });

  if (evidence.length === dim.evidence.length) return dim;

  const verified = evidence.filter(
    (e) => e.verificationStatus === "verified" || e.demonstrated,
  ).length;
  const removed = dim.evidence.length - evidence.length;

  return {
    ...dim,
    evidence,
    verifiedEvidenceCount: verified,
    rejectedEvidenceCount: dim.rejectedEvidenceCount + removed,
  };
}

/**
 * Finalize partial/full dimension copy after score is settled.
 * Sets whyNotFullMarks, aligns quickFix, and sanitizes evidence.
 */
export function finalizeDimensionAdjudication(
  dim: DimensionResult,
  callType: CallType,
  result?: EvaluationResult,
): DimensionResult {
  let next = sanitizeDimensionEvidence(dim);

  if (!isScored(next) || next.score === null) {
    return { ...next, whyNotFullMarks: null };
  }

  if (isFullMarks(next)) {
    return {
      ...next,
      whyNotFullMarks: null,
      quickFix: FULL_MARKS_QUICK_FIX,
    };
  }

  const whyNotFullMarks = hideInternalIds(
    computeWhyNotFullMarks(next, callType) ?? "",
  ).trim();

  let quickFix = next.quickFix?.trim() ?? "";
  const rubricFix = rubricQuickFix(next.id, callType);

  if (
    !quickFix ||
    quickFix === FULL_MARKS_QUICK_FIX ||
    quickFixContradictsEvidence(next, quickFix)
  ) {
    quickFix = rubricFix ?? quickFix;
  }

  if (quickFixContradictsEvidence(next, quickFix) && rubricFix) {
    quickFix = rubricFix;
  }

  void result;
  void performanceLevel(next, result);

  return {
    ...next,
    whyNotFullMarks: whyNotFullMarks || null,
    quickFix: hideInternalIds(quickFix),
  };
}

export function finalizeEvaluationAdjudication(
  result: EvaluationResult,
): EvaluationResult {
  const dimensions = result.dimensions.map((d) =>
    finalizeDimensionAdjudication(d, result.callType, result),
  );
  return { ...result, dimensions };
}
