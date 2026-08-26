import type { DimensionResult } from "@/lib/rubrics/types";
import {
  FULL_MARKS_QUICK_FIX,
  isIncompleteQuickFix,
} from "@/lib/scoring/quickFix";
import {
  firstSentence,
  hideInternalIds,
} from "@/lib/ui/reportPresentation";
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

function fullMarksPraise(dim: DimensionResult): string | null {
  const cleaned = hideInternalIds(dim.rationale.trim()).replace(
    /^scored\s+\d+(?:\.\d+)?\s*\/\s*\d+\s*(?:because\s+)?/i,
    "",
  );
  if (cleaned.length < 28) return null;
  if (
    /scored from the rubric|could have been better|not demonstrated|missing elite/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  return firstSentence(cleaned);
}

function claimsUnverifiedAsFact(dim: DimensionResult, text: string): boolean {
  if (dim.verifiedEvidenceCount > 0) return false;
  if (dim.rejectedEvidenceCount === 0 && !dim.notDemonstrated) return false;
  return /the client (clearly )?(stated|named|established|confirmed|shared)|clearly established/i.test(
    text,
  );
}

function coachingDimensionFix(dim: DimensionResult): QuickFixView | null {
  const visionUnverified =
    dim.verifiedEvidenceCount === 0 && dim.rejectedEvidenceCount > 0;

  switch (dim.id) {
    case "d3":
      return {
        title: "Connect the current block to the long-term vision",
        body: visionUnverified
          ? "The transcript does not provide sufficient verified evidence of a clearly established long-term vision. Explicitly name the current training block, reconnect it to the client's longer-term goal, and explain how today's work moves them toward that outcome."
          : "Explicitly name the current training block, reconnect it to the client's longer-term goal, and explain how today's work moves them toward that outcome.",
        steps: null,
        complete: false,
      };
    case "d5":
      return {
        title: "Frame the adjustment as strategy",
        body: "Explain the adjustment as strategy that protects the long game, not a demotion, and check that the client understands why it is the right move now.",
        steps: null,
        complete: false,
      };
    case "d6":
      return {
        title: "Make accountability owned and time-bound",
        body: "Give the client one clear deliverable, assign an owner and deadline, and confirm what happens if the commitment is missed.",
        steps: null,
        complete: false,
      };
    case "d7":
      return {
        title: "Name one client-owned deliverable",
        body: "Name one client-owned deliverable, get a spoken confirmation, and state what happens if it is missed.",
        steps: null,
        complete: false,
      };
    case "d10":
      return {
        title: "Book the next call before ending the session",
        body: "Choose the next date and time with the client while still on the call, confirm it out loud, and ensure the calendar invite is sent before ending the session.",
        steps: null,
        complete: false,
      };
    case "d11":
      return {
        title: "Make follow-up owned and timed",
        body: "Restate the accountability anchor and name the coach follow-up with a specific time and channel so both sides know who owes what after the call.",
        steps: null,
        complete: false,
      };
    default:
      return null;
  }
}

function dedupeTitleBody(title: string, body: string | null): {
  title: string;
  body: string | null;
} {
  if (!body) return { title, body };
  const norm = (s: string) =>
    s.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  if (norm(title) === norm(body)) {
    return { title, body: null };
  }
  return { title, body };
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
      body: fullMarksPraise(dim),
      steps: null,
      complete: true,
    };
  }

  if (callType === "coaching") {
    const coaching = coachingDimensionFix(dim);
    if (coaching) return coaching;
  }

  const source = sourceText(dim);
  const usable = Boolean(source) && !isIncompleteQuickFix(source);

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

  if (!usable) {
    return null;
  }

  if (GENERIC_ADVICE.test(source) && source.split(/\s+/).length < 8) {
    const view = {
      title: titleFromAction(source),
      body: polishActionOutcome(source),
      steps: null,
      complete: false,
    };
    const deduped = dedupeTitleBody(view.title, view.body);
    return { ...view, ...deduped };
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

  let body = polishActionOutcome(source);
  if (claimsUnverifiedAsFact(dim, body)) {
    body =
      "The transcript does not provide sufficient verified evidence of that behaviour. " +
      body;
  }

  const deduped = dedupeTitleBody(titleFromAction(source), body);
  return {
    title: deduped.title,
    body: deduped.body,
    steps: null,
    complete: false,
  };
}
