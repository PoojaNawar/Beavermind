import type { DimensionResult } from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";

export type QuickFixView = {
  title: string;
  body: string | null;
  steps: string[] | null;
  complete: boolean;
};

const GENERIC_ADVICE =
  /^(communicate better|build rapport|be more empathetic|do better|try harder)\.?$/i;

const PERSONAL_SHARE_RE =
  /personal (stor(y|ies)|experience)|emotional connection|open up|relate to the client/i;

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

function sourceText(dim: DimensionResult): string {
  return dim.quickFix.trim();
}

function titleFromAction(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^[.-\s]+/, "")
    .replace(
      /^(incorporate|try to|make sure to|you should|the coach should)\s+/i,
      "",
    )
    .replace(/\.$/, "");
  const first = cleaned.split(/,|\.\s+| then /i)[0]?.trim() ?? cleaned;
  const words = first.split(/\s+/).slice(0, 8).join(" ");
  if (!words || GENERIC_ADVICE.test(words)) {
    return "Do this to reach full marks";
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function polishActionOutcome(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
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

  if (GENERIC_ADVICE.test(source)) {
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
