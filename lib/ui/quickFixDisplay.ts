"use client";

import type { DimensionResult } from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";
import {
  quickFixForDisplay,
  sanitizeQuickFixTypography,
} from "@/lib/ui/quickFixTypography";

export type QuickFixView = {
  title: string;
  body: string | null;
  steps: string[] | null;
  complete: boolean;
};

const GENERIC_ADVICE =
  /improve communication|build( more)? rapport|be more empathetic|do better|try harder|be a better listener/i;

const PERSONAL_SHARE_RE =
  /personal (stor(y|ies)|experience)|emotional connection|open up|relate to the client|mirrors the client/i;

const ANCHORED_RECAP_RE =
  /structured recap|emotional (reinforcement|anchor)|generic recap|\brecap\b/i;

const KICKOFF_RECAP_STEPS = [
  "what the client wants",
  "why it matters emotionally",
  "what was agreed",
  "the next concrete step",
  "why that next step matters to the client's goal",
];

function isRapportDimension(dim: DimensionResult, callType: string): boolean {
  if (callType === "kickoff") return dim.id === "d2";
  return dim.id === "d1";
}

function isKickoffCloseRecap(dim: DimensionResult, callType: string): boolean {
  return callType === "kickoff" && dim.id === "d11";
}

function verifiedQuotes(dim: DimensionResult): string {
  return dim.evidence
    .filter((item) => item.verificationStatus === "verified")
    .map((item) => item.quote)
    .join("\n")
    .toLowerCase();
}

function alreadyHasStructuredRecap(dim: DimensionResult): boolean {
  const quotes = verifiedQuotes(dim);
  if (!quotes.trim()) return false;
  return (
    /\brecap\b/.test(quotes) ||
    /here'?s what we (covered|did|walked)/.test(quotes) ||
    (quotes.includes("north star") && /day[- ]thirty|day 30/.test(quotes))
  );
}

function sourceText(dim: DimensionResult): string {
  return sanitizeQuickFixTypography(dim.quickFix);
}

function titleFromAction(text: string): string {
  const cleaned = quickFixForDisplay(text)
    .replace(/^[.-\s]+/, "")
    .replace(
      /^(incorporate|try to|make sure to|you should|the coach should)\s+/i,
      "",
    )
    .replace(/\.$/, "");
  if (/diagnostic.+film.+upload/i.test(cleaned)) {
    return "Confirm the diagnostic → film → upload workflow";
  }
  const first = cleaned.split(/,\s+|\.\s+| then /i)[0]?.trim() ?? cleaned;
  const words = first.split(/\s+/).slice(0, 10).join(" ");
  if (!words || GENERIC_ADVICE.test(words)) {
    return "Do this to reach full marks";
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function polishActionOutcome(text: string): string {
  const trimmed = quickFixForDisplay(text).replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const incorporate = trimmed.match(
    /^Incorporate (?:more |a more |an? )?(.+?) to (enhance|improve|strengthen) (.+)$/i,
  );
  if (incorporate) {
    const action = incorporate[1]!.replace(/\.$/, "");
    const outcome = incorporate[3]!.replace(/\.$/, "");
    return `${action.charAt(0).toUpperCase()}${action.slice(1)}, so it ${incorporate[2]!.toLowerCase()} ${outcome}.`;
  }
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function kickoffGoalAlignmentFix(): QuickFixView {
  return {
    title: "Lock the North Star and 30-day marker",
    body: "State the emotional why back to the client, name it as the North Star, and confirm a concrete 30-day marker they agree to.",
    steps: null,
    complete: false,
  };
}

function kickoffProgramFix(): QuickFixView {
  return {
    title: "Tie each phase to an outcome and their goal",
    body: "For each phase, say what it does, what changes for the client, and how it serves their specific goal. Use an analogy if it helps the path land.",
    steps: null,
    complete: false,
  };
}

function kickoffNextStepsFix(): QuickFixView {
  return {
    title: "Confirm the diagnostic → film → upload workflow",
    body: "Explain what the client needs to record, where it should be uploaded, and the deadline. Confirm that the client understands the sequence before ending the call.",
    steps: null,
    complete: false,
  };
}

/**
 * Present the stored quickFix as a coach-facing title + action.
 * Does not change scores, evidence, or the stored evaluation payload.
 */
export function presentQuickFix(
  dim: DimensionResult,
  callType: string,
): QuickFixView | null {
  if (dim.disabled || dim.notApplicable) {
    return null;
  }

  const atFullMarks =
    dim.score !== null && dim.score >= dim.maxScore;

  if (atFullMarks) {
    return {
      title: FULL_MARKS_QUICK_FIX,
      body: null,
      steps: null,
      complete: true,
    };
  }

  const source = sourceText(dim);
  if (!source) {
    return null;
  }

  if (callType === "kickoff" && dim.id === "d9") {
    return kickoffNextStepsFix();
  }

  if (
    callType === "kickoff" &&
    dim.id === "d4" &&
    /north star|emotional why|30-day|thirty.day|day thirty/i.test(source)
  ) {
    return kickoffGoalAlignmentFix();
  }

  if (
    callType === "kickoff" &&
    dim.id === "d5" &&
    /phase|analogy|program explanation/i.test(source)
  ) {
    return kickoffProgramFix();
  }

  if (GENERIC_ADVICE.test(source) && source.split(/\s+/).length < 8) {
    return {
      title: titleFromAction(source),
      body: polishActionOutcome(source),
      steps: null,
      complete: false,
    };
  }

  if (isRapportDimension(dim, callType) && PERSONAL_SHARE_RE.test(source)) {
    return {
      title: "Deepen the personal connection",
      body: "Share a brief, relevant personal experience that mirrors the client's situation, then connect it back to what the client is feeling.",
      steps: null,
      complete: false,
    };
  }

  if (
    isKickoffCloseRecap(dim, callType) &&
    ANCHORED_RECAP_RE.test(`${source} ${dim.rationale}`)
  ) {
    if (alreadyHasStructuredRecap(dim)) {
      return {
        title: "The recap is already in the transcript",
        body: "Do not treat this as a missing recap. The verified quotes already include a structured close. If the score is below 5, the remaining gap is confidence or emotional reinforcement — not listing the agenda again.",
        steps: null,
        complete: false,
      };
    }
    return {
      title: "Make the recap emotionally anchored",
      body: "Close by summarizing:",
      steps: KICKOFF_RECAP_STEPS,
      complete: false,
    };
  }

  return {
    title: titleFromAction(source),
    body: polishActionOutcome(source),
    steps: null,
    complete: false,
  };
}
