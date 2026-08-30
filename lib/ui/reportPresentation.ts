import type {
  DimensionResult,
  EvaluationResult,
  FiredCap,
  OneThing,
} from "@/lib/rubrics/types";
import {
  actionOneThingForDimension,
  repairEvaluationConsistency,
} from "@/lib/scoring/consistency";
import {
  heldBackPhrase,
  performanceLevel,
  performanceLevelLabel,
} from "@/lib/scoring/dimensionAdjudication";
import {
  computeScoreIfApplied,
  resolveLeverageTheme,
  topMissedDimension,
  type LeverageTheme,
} from "@/lib/scoring/scoreIfApplied";

export type ImpactLevel = "critical" | "high" | "opportunity";

export type BriefSections = {
  well: string;
  held: string;
  next: string;
};

export type NotApplicableCopy = {
  label: string;
  explanation: string;
};

const INTERNAL_DIM_ID = /\b[dD](1[0-2]|[1-9])\b/g;

const GENERIC_IMPACT =
  /improve the coaching experience|better coaching experience|help the client succeed|more effective coach|this will improve/i;

const LOW_LEVERAGE_ONE_THING =
  /community|post(ing)? more|share more (often|in the community)|feel more connected/i;

const RAISE_BEFORE_CALL_RE = /^raise .+ before the next call/i;

export function hideInternalIds(text: string): string {
  return text
    .replace(INTERNAL_DIM_ID, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.+?[.!?](?=\s|$)/);
  return match ? match[0].trim() : trimmed;
}

function scoredDimensions(result: EvaluationResult): DimensionResult[] {
  return result.dimensions.filter(
    (d) => !d.disabled && !d.notApplicable && d.score !== null,
  );
}

function gapOf(dim: DimensionResult): number {
  if (dim.score === null) return 0;
  return Math.max(0, dim.maxScore - dim.score);
}

function isMissed(dim: DimensionResult): boolean {
  return (
    !dim.disabled &&
    !dim.notApplicable &&
    dim.score !== null &&
    dim.score < dim.maxScore
  );
}

function dimById(
  result: EvaluationResult,
  id: string,
): DimensionResult | undefined {
  return result.dimensions.find((d) => d.id === id);
}

function joinHuman(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function notApplicableCopy(dim: DimensionResult): NotApplicableCopy | null {
  if (!dim.disabled && !dim.notApplicable) return null;

  if (dim.notApplicable) {
    return {
      label: "Not applicable",
      explanation:
        dim.notApplicableReason?.trim() ||
        (dim.id === "d2"
          ? "No diagnostics review occurred during this cycle, so this dimension was not scored."
          : "This dimension did not apply to the current call, so it was not scored."),
    };
  }

  return {
    label: "Not applicable",
    explanation:
      dim.disabledReason?.trim() ||
      (dim.id === "d4"
        ? "Movement coaching did not occur on this call, so this dimension was not scored."
        : "This dimension did not apply to the current call, so it was not scored."),
  };
}

/** Status chip for dimension cards — FULL MARKS / OPPORTUNITY / CRITICAL / NOT APPLICABLE. */
export function dimensionStatusLabel(
  dim: DimensionResult,
  result: EvaluationResult,
): string | null {
  const na = notApplicableCopy(dim);
  if (na) return "NOT APPLICABLE";
  if (dim.score !== null && dim.score >= dim.maxScore) return "FULL MARKS";
  const levelLabel = performanceLevelLabel(performanceLevel(dim, result));
  if (levelLabel) return levelLabel;
  const impact = dimensionImpact(dim, result);
  if (impact === "critical") return "CRITICAL";
  if (impact) return "OPPORTUNITY";
  return null;
}

export type DimensionOverview = {
  total: number;
  strong: number;
  opportunities: number;
  critical: number;
  notApplicable: number;
  summary: string;
};

/** Dynamic dimension strip summary: "10 strong · 2 opportunities". */
export function dimensionOverview(result: EvaluationResult): DimensionOverview {
  let strong = 0;
  let opportunities = 0;
  let critical = 0;
  let notApplicable = 0;

  for (const dim of result.dimensions) {
    if (dim.disabled || dim.notApplicable) {
      notApplicable += 1;
      continue;
    }
    if (dim.score === null) continue;
    if (dim.score >= dim.maxScore) {
      strong += 1;
      continue;
    }
    const impact = dimensionImpact(dim, result);
    if (impact === "critical") critical += 1;
    else opportunities += 1;
  }

  const parts: string[] = [];
  if (strong > 0) parts.push(`${strong} strong`);
  if (opportunities > 0) {
    parts.push(
      `${opportunities} ${opportunities === 1 ? "opportunity" : "opportunities"}`,
    );
  }
  if (critical > 0) parts.push(`${critical} critical`);
  if (notApplicable > 0) {
    parts.push(`${notApplicable} not applicable`);
  }

  return {
    total: result.dimensions.length,
    strong,
    opportunities,
    critical,
    notApplicable,
    summary: parts.length > 0 ? parts.join(" · ") : "No scored dimensions",
  };
}

function capHitsDimension(cap: FiredCap, dim: DimensionResult): boolean {
  if (cap.id === "next-call-not-booked") return dim.id === "d10";
  if (cap.id === "struggle-ignored") return dim.id === "d8";
  if (cap.id === "no-long-term-vision") return dim.id === "d3";
  if (cap.id === "no-accountability-commitment") return dim.id === "d6";
  if (cap.id === "no-north-star") return dim.id === "d4";
  if (cap.id === "no-action-steps") return dim.id === "d6";
  return false;
}

function isForcedZero(result: EvaluationResult, dim: DimensionResult): boolean {
  return result.firedCaps.some(
    (cap) =>
      capHitsDimension(cap, dim) &&
      (cap.id === "next-call-not-booked" || cap.id === "struggle-ignored"),
  );
}

/**
 * Severity only when the rubric justifies it. Full-mark dimensions stay unlabeled.
 */
export function dimensionImpact(
  dim: DimensionResult,
  result: EvaluationResult,
): ImpactLevel | null {
  if (!isMissed(dim) || dim.score === null) return null;

  if (isForcedZero(result, dim) || dim.score === 0) {
    return "critical";
  }

  const ratio = dim.score / dim.maxScore;
  const gap = gapOf(dim);
  if (gap >= 5 || ratio <= 0.6) return "high";
  return "opportunity";
}

export function impactLabel(level: ImpactLevel): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "high":
      return "Opportunity";
    case "opportunity":
      return "Opportunity";
  }
}

function humanizeCap(cap: FiredCap, result: EvaluationResult): string | null {
  switch (cap.id) {
    case "next-call-not-booked":
      return "Next Call Booking received 0/5 because the next call was not booked live.";
    case "no-long-term-vision": {
      const d3 = dimById(result, "d3");
      const score = d3?.score ?? 10;
      const max = d3?.maxScore ?? 15;
      return `${d3?.name ?? "Program Focus + Vision"} was limited to ${score}/${max} because a long-term vision was not clearly established.`;
    }
    case "no-north-star": {
      const d4 = dimById(result, "d4");
      return `${d4?.name ?? "Goal Alignment"} was subject to the rubric's scoring constraint because a North Star was not constructed.`;
    }
    case "no-accountability-commitment": {
      const d6 = dimById(result, "d6");
      return `${d6?.name ?? "Action Steps & Accountability"} was limited because no client-owned accountability commitment was confirmed.`;
    }
    case "struggle-ignored":
      return "Struggle Handling received 0 because a client struggle was present and not coached through.";
    case "no-action-steps":
      return "The overall score was limited because no action steps were stated for either party before the close.";
    case "no-follow-ups":
      return "The overall score was limited because no follow-up questions were asked.";
    case "coach-monologue":
      return "The overall score was limited because the call was dominated by coach monologue.";
    case "unresolved-confusion":
      return "The overall score was limited because client confusion was left unresolved.";
    default: {
      const cleaned = hideInternalIds(cap.condition || cap.effect);
      if (!cleaned || /\bd\d+\b/i.test(cleaned)) return null;
      return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
    }
  }
}

export function scoringNotes(result: EvaluationResult): string[] {
  const notes: string[] = [];
  const skipped = result.dimensions.filter((d) => d.disabled || d.notApplicable);
  if (skipped.length > 0) {
    notes.push(
      skipped.length === 1
        ? "1 dimension was not applicable this cycle."
        : `${skipped.length} dimensions were not applicable this cycle.`,
    );
  }

  const seen = new Set<string>();
  for (const cap of result.firedCaps) {
    const note = humanizeCap(cap, result);
    if (!note) continue;
    const key = note.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
  }

  return notes;
}

function gapPhrase(dim: DimensionResult, callType: string): string {
  if (callType === "coaching") {
    if (dim.id === "d10") return "live next-call booking";
    if (dim.id === "d3") return "long-term vision";
    if (dim.id === "d6" || dim.id === "d7") return "accountability";
    if (dim.id === "d11") return "continuity";
    if (dim.id === "d5") return "adjustment framing";
  }
  if (callType === "kickoff") {
    if (dim.id === "d4") return "goal alignment";
    if (dim.id === "d2") return "rapport depth";
    if (dim.id === "d5") return "program explanation";
    if (dim.id === "d9") return "next-step clarity";
    if (dim.id === "d11") return "close and recap";
    if (dim.id === "d10") return "next-call booking";
    if (dim.id === "d1") return "prep visibility";
    if (dim.id === "d3") return "agenda framing";
    if (dim.id === "d6") return "journey and expectation setting";
    if (dim.id === "d7") return "support system clarity";
  }
  return dim.name.replace(/\s*&\s*/g, " and ").toLowerCase();
}

function uniquePhrases(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

/** Short coach-facing strength labels for summary / well sections. */
function strengthLabel(dim: DimensionResult, callType: string): string {
  if (callType === "kickoff") {
    switch (dim.id) {
      case "d1":
        return "preparation";
      case "d2":
        return "rapport";
      case "d3":
        return "agenda framing";
      case "d4":
        return "goal alignment";
      case "d5":
        return "program explanation";
      case "d6":
        return "journey setting";
      case "d7":
        return "support clarity";
      case "d8":
        return "coaching intelligence";
      case "d9":
        return "next-step clarity";
      case "d10":
        return "follow-through";
      case "d11":
        return "close and recap";
      case "d12":
        return "call control";
    }
  }
  if (callType === "coaching") {
    switch (dim.id) {
      case "d1":
        return "client connection";
      case "d3":
        return "vision";
      case "d5":
        return "adjustment framing";
      case "d6":
        return "accountability";
      case "d7":
        return "accountability anchor";
      case "d8":
        return "struggle handling";
      case "d9":
        return "close quality";
      case "d10":
        return "live booking";
      case "d11":
        return "continuity";
      case "d12":
        return "session structure";
    }
  }
  return dim.name.replace(/\s*&\s*/g, " and ").toLowerCase();
}

function wellActionPhrase(dim: DimensionResult, callType: string): string {
  if (callType === "kickoff") {
    switch (dim.id) {
      case "d2":
        return "built strong rapport";
      case "d4":
        return "connected the program to the client's goals";
      case "d5":
        return "explained the program clearly";
      case "d6":
        return "explained the journey clearly";
      case "d7":
        return "established clear support and follow-up expectations";
      case "d10":
        return "booked the next call live";
      case "d11":
        return "closed with a clear recap";
      case "d1":
        return "showed visible preparation";
      case "d3":
        return "framed the agenda upfront";
      case "d8":
        return "asked insightful coaching questions";
    }
  }
  if (callType === "coaching") {
    switch (dim.id) {
      case "d1":
        return "built strong client connection";
      case "d8":
        return "handled struggle with skill";
      case "d9":
        return "closed the session cleanly";
      case "d12":
        return "kept clear session structure";
      case "d3":
        return "connected work to long-term vision";
      case "d6":
        return "set clear accountability";
      case "d10":
        return "booked the next call live";
      case "d11":
        return "set clear continuity";
    }
  }
  return `delivered strong ${strengthLabel(dim, callType)}`;
}

function heldDetail(dim: DimensionResult, callType: string): string {
  if (dim.whyNotFullMarks) {
    return heldBackPhrase(dim, callType as EvaluationResult["callType"]);
  }
  if (callType === "kickoff" && dim.id === "d9") {
    return "The main gap was next-step clarity: the coach explained the diagnostic workflow and deadline, but did not fully confirm the client's understanding of what to do next.";
  }
  if (callType === "kickoff" && dim.id === "d4") {
    return "The main gap was goal alignment: the emotional why was not fully stated back, confirmed, and locked to a concrete 30-day marker.";
  }
  if (callType === "kickoff" && dim.id === "d2") {
    return "The main gap was rapport depth: connection stayed surface-level and did not fully return focus to the client's situation.";
  }
  if (callType === "kickoff" && dim.id === "d1") {
    return "The main gap was prep visibility: intake details were not surfaced early enough to prove the coach arrived prepared.";
  }
  if (callType === "kickoff" && dim.id === "d3") {
    return "The main gap was agenda framing: time, sequenced phases, and explicit client consent were not all secured upfront.";
  }
  if (callType === "kickoff" && dim.id === "d6") {
    return "The main gap was journey and expectation setting: valleys and emotional friction were not prepared clearly enough.";
  }
  if (callType === "kickoff" && dim.id === "d11") {
    return "The main gap was the close: the recap did not fully reconnect to the goal and next concrete step.";
  }
  if (callType === "coaching" && dim.id === "d10") {
    return "The main gap was live next-call booking: the next session was not booked with a confirmed date and time before the call ended.";
  }
  if (callType === "coaching" && dim.id === "d3") {
    return "The main gap was long-term vision: the current block was not clearly connected to a confirmed longer-term outcome.";
  }
  if (callType === "coaching" && (dim.id === "d6" || dim.id === "d7")) {
    return "The main gap was accountability: ownership, deadlines, and confirmation were not fully locked in.";
  }
  if (callType === "coaching" && dim.id === "d11") {
    return "The main gap was continuity: coach and client follow-up were not both clear on what, when, and through which channel.";
  }
  if (callType === "coaching" && dim.id === "d5") {
    return "The main gap was adjustment framing: the change was not clearly framed as strategy that protects the long game.";
  }
  if (hasUnverifiedOnly(dim) && callType === "coaching" && dim.id === "d3") {
    return "The main gap was a clearly verified long-term vision.";
  }
  return `The main gap was ${gapPhrase(dim, callType)}: verified evidence did not fully satisfy the elite criteria for this dimension.`;
}

function nextActionCopy(dim: DimensionResult, callType: string): string {
  if (callType === "kickoff" && dim.id === "d9") {
    return "Before closing, have the client confirm the diagnostic → film → upload sequence, including what needs to be completed and by when.";
  }
  if (callType === "kickoff" && dim.id === "d4") {
    return "Before closing, state the emotional why back, name it as the North Star, and confirm a concrete 30-day marker the client agrees to.";
  }
  if (callType === "kickoff" && dim.id === "d2") {
    return "Share a relevant personal moment, connect it to the client's situation, and return focus to their goals before moving on.";
  }
  if (callType === "kickoff" && dim.id === "d1") {
    return "In the opening minutes, reference two specific intake details so preparation is immediately visible.";
  }
  if (callType === "kickoff" && dim.id === "d3") {
    return "State the time, list three sequenced phases, and get an explicit yes before diving in.";
  }
  if (callType === "kickoff" && dim.id === "d6") {
    return "Name the valleys ahead and separate good pain from bad pain so the client is emotionally ready.";
  }
  if (callType === "kickoff" && dim.id === "d11") {
    return "Close with a specific recap that reconnects to the goal and the next concrete step.";
  }
  if (callType === "coaching" && dim.id === "d10") {
    return "Before ending, choose the next date and time live, confirm it out loud, and send the calendar invite.";
  }
  if (callType === "coaching" && dim.id === "d3") {
    return "Name the current training block, reconnect it to the long-term vision, and confirm how today's work serves that outcome.";
  }
  if (callType === "coaching" && (dim.id === "d6" || dim.id === "d7")) {
    return "Leave with one client-owned deliverable, a deadline, spoken confirmation, and a clear miss consequence.";
  }
  if (callType === "coaching" && dim.id === "d11") {
    return "Restate what the coach owes and what the client owes, with timing and channel, before ending the call.";
  }
  if (callType === "coaching" && dim.id === "d5") {
    return "Frame the adjustment as strategy that protects the long game, and check that the client understands why it is the right move now.";
  }
  const one = actionOneThingForDimension(dim, callType);
  return hideInternalIds(one.impact).replace(/\.?$/, ".");
}

function preferStrengthIds(
  full: DimensionResult[],
  preferred: string[],
): DimensionResult[] {
  const byId = new Map(full.map((d) => [d.id, d]));
  const picked: DimensionResult[] = [];
  for (const id of preferred) {
    const dim = byId.get(id);
    if (dim) picked.push(dim);
  }
  if (picked.length >= 2) return picked.slice(0, 4);
  return full.slice(0, 4);
}

const GENERIC_SUMMARY =
  /^(a call with mixed execution|mixed call|strong coaching|improve the coaching experience)\.?$/i;

function isThinCopy(text: string): boolean {
  const cleaned = hideInternalIds(text).trim();
  if (cleaned.length < 24) return true;
  if (GENERIC_SUMMARY.test(cleaned)) return true;
  if (/^strong [a-z0-9 &]+?\.$/i.test(cleaned) && cleaned.split(/\s+/).length < 6) {
    return true;
  }
  return false;
}

function buildWentWell(
  full: DimensionResult[],
  callType: string,
): string {
  if (full.length === 0) {
    return "No scored dimension reached full marks on this call.";
  }

  const preferred =
    callType === "kickoff"
      ? preferStrengthIds(full, ["d2", "d4", "d6", "d7", "d5", "d10", "d11", "d1"])
      : preferStrengthIds(full, ["d1", "d8", "d9", "d12", "d3", "d6", "d10", "d11"]);

  const actions = uniquePhrases(
    preferred.slice(0, 4).map((d) => wellActionPhrase(d, callType)),
  );
  if (actions.length === 0) {
    return `Strong ${joinHuman(
      full.slice(0, 3).map((d) => strengthLabel(d, callType)),
    )}.`;
  }
  return `The coach ${joinHuman(actions)}.`;
}

function buildHeldBack(
  missed: DimensionResult[],
  callType: string,
): string {
  if (missed.length === 0) {
    return "Exceptional performance across every evaluated dimension. No material gaps were identified.";
  }
  const primary = heldDetail(missed[0]!, callType);
  if (missed.length === 1) return primary;

  const extras = uniquePhrases(
    missed.slice(1, 3).map((d) => gapPhrase(d, callType)),
  );
  if (extras.length === 0) return primary;
  return `${primary.replace(/\.$/, "")}. Secondary gaps included ${joinHuman(extras)}.`;
}

function buildWhatNext(
  missed: DimensionResult[],
  callType: string,
  refined: OneThing,
): string {
  if (missed.length === 0) {
    return "Keep this standard on the next call and repeat the same level of evidence-backed coaching.";
  }
  const top = missed[0]!;
  const specific = nextActionCopy(top, callType);
  if (!isThinCopy(specific)) return specific;
  const fromOne = hideInternalIds(refined.impact || refined.recommendation).trim();
  if (fromOne.length >= 24) {
    return fromOne.replace(/\.?$/, ".");
  }
  return `Focus on ${gapPhrase(top, callType)} before the next call.`;
}

function buildSummary(
  full: DimensionResult[],
  missed: DimensionResult[],
  callType: string,
  overallScore?: number,
): string {
  if (missed.length === 0) {
    return "Exceptional overall performance across every scored dimension. Keep repeating this evidence-backed standard on the next call.";
  }

  const top = missed[0]!;
  const topGap = gapOf(top);

  if ((overallScore ?? 0) >= 99 && missed.length === 1 && topGap <= 1) {
    const area = strengthLabel(top, callType);
    return `Exceptional overall performance. The only remaining opportunity is a minor refinement in ${area}.`;
  }

  if ((overallScore ?? 0) >= 95 && missed.length === 1 && topGap <= 2) {
    const area = strengthLabel(top, callType);
    return `Strong overall performance with excellent execution across nearly every dimension. A small opportunity remains in ${area}.`;
  }

  const preferred =
    callType === "kickoff"
      ? preferStrengthIds(full, ["d2", "d4", "d5", "d10", "d6", "d7", "d1", "d11"])
      : preferStrengthIds(full, ["d1", "d8", "d9", "d12", "d3", "d6", "d10"]);

  const strengths = uniquePhrases(
    preferred.slice(0, 4).map((d) => strengthLabel(d, callType)),
  );

  let opportunity: string;
  const level = performanceLevel(top);
  if (level === "minor_opportunity") {
    opportunity = `The only remaining opportunity is a minor refinement in ${gapPhrase(top, callType)}.`;
  } else if (callType === "kickoff" && top.id === "d9") {
    opportunity =
      "The main opportunity is to make next-step instructions even clearer and confirm the client's understanding before closing the call.";
  } else if (callType === "coaching" && top.id === "d10") {
    opportunity =
      "The main opportunity is to book the next call live with a confirmed date and time before ending the session.";
  } else {
    opportunity = `The main opportunity is to strengthen ${gapPhrase(top, callType)} before the next call.`;
  }

  if (strengths.length === 0) {
    return `The score was held back by ${gapPhrase(top, callType)}. ${opportunity}`;
  }

  return `Strong overall performance with excellent ${joinHuman(strengths)}. ${opportunity}`;
}

function hasUnverifiedOnly(dim: DimensionResult): boolean {
  return dim.verifiedEvidenceCount === 0 && dim.rejectedEvidenceCount > 0;
}

/**
 * Validate that summary sections are non-empty, specific, and aligned
 * with scored dimensions. Returns repaired copy when needed.
 */
export function validateBriefSections(
  sections: BriefSections & { summary: string },
  result: EvaluationResult,
): BriefSections & { summary: string } {
  const scored = scoredDimensions(result);
  const full = scored.filter((d) => d.score === d.maxScore);
  const missed = scored
    .filter(isMissed)
    .sort((a, b) => gapOf(b) - gapOf(a) || a.name.localeCompare(b.name));
  const refined = refineOneThing(result);

  let { summary, well, held, next } = sections;

  if (isThinCopy(summary)) {
    summary = buildSummary(full, missed, result.callType, result.overallScore);
  }
  if (isThinCopy(well)) {
    well = buildWentWell(full, result.callType);
  }
  if (isThinCopy(held)) {
    held = buildHeldBack(missed, result.callType);
  }
  if (isThinCopy(next)) {
    next = buildWhatNext(missed, result.callType, refined);
  }

  // Consistency: never praise a missed dimension in "went well".
  for (const dim of missed.slice(0, 3)) {
    const label = strengthLabel(dim, result.callType);
    if (well.toLowerCase().includes(label) && missed.length > 0) {
      well = buildWentWell(full, result.callType);
      break;
    }
  }

  // Consistency: held/next must reference an actual gap when one exists.
  if (missed.length > 0) {
    const topGap = gapPhrase(missed[0]!, result.callType);
    const topLabel = strengthLabel(missed[0]!, result.callType);
    const heldOk =
      held.toLowerCase().includes(topGap.split(" ")[0]!) ||
      held.toLowerCase().includes(topLabel.split(" ")[0]!) ||
      /main gap|lacked|did not|missing|not fully/i.test(held);
    if (!heldOk) held = buildHeldBack(missed, result.callType);
  }

  return {
    summary: hideInternalIds(summary).replace(/\.?$/, ".").replace(/\.\.$/, "."),
    well: hideInternalIds(well).replace(/\.?$/, ".").replace(/\.\.$/, "."),
    held: hideInternalIds(held).replace(/\.?$/, ".").replace(/\.\.$/, "."),
    next: hideInternalIds(next).replace(/\.?$/, ".").replace(/\.\.$/, "."),
  };
}

export function scoreHeadline(result: EvaluationResult): string {
  const scored = scoredDimensions(result);
  const full = scored.filter((d) => d.score === d.maxScore);
  const missed = scored
    .filter(isMissed)
    .sort((a, b) => gapOf(b) - gapOf(a) || a.name.localeCompare(b.name));
  return validateBriefSections(
    {
      summary: buildSummary(full, missed, result.callType, result.overallScore),
      well: "",
      held: "",
      next: "",
    },
    result,
  ).summary;
}

export function briefSections(result: EvaluationResult): BriefSections {
  const scored = scoredDimensions(result);
  const full = scored.filter((d) => d.score === d.maxScore);
  const missed = scored
    .filter(isMissed)
    .sort((a, b) => gapOf(b) - gapOf(a) || a.name.localeCompare(b.name));
  const refined = refineOneThing(result);

  const validated = validateBriefSections(
    {
      summary: buildSummary(full, missed, result.callType, result.overallScore),
      well: buildWentWell(full, result.callType),
      held: buildHeldBack(missed, result.callType),
      next: buildWhatNext(missed, result.callType, refined),
    },
    result,
  );

  return {
    well: validated.well,
    held: validated.held,
    next: validated.next,
  };
}

function copyForTheme(
  theme: LeverageTheme,
  result: EvaluationResult,
): { recommendation: string; impact: string } | null {
  switch (theme) {
    case "accountability-loop":
      return {
        recommendation:
          "Book the next call and close the accountability loop before the session ends.",
        impact:
          "Booking the next call and confirming ownership before the session ends reduces ambiguity, strengthens accountability, and makes continuity between sessions much more reliable.",
      };
    case "live-booking":
      return {
        recommendation: "Book the next call before the session ends.",
        impact:
          "Choosing a date and time live, confirming it out loud, and sending the invite before hanging up removes ambiguity and keeps the coaching relationship moving.",
      };
    case "vision":
      return {
        recommendation: "Connect the current block to the long-term vision.",
        impact:
          "Naming the current block and tying it to a confirmed long-term outcome gives today's work a North Star the client can feel, not just a set of logistics.",
      };
    case "north-star":
      return {
        recommendation: "Lock the North Star and a 30-day marker.",
        impact:
          "When the emotional why is named, confirmed, and tied to a near-term marker, the rest of the program has something concrete to serve.",
      };
    case "largest-gap": {
      const top = topMissedDimension(result);
      if (!top) return null;
      return actionOneThingForDimension(top, result.callType);
    }
    default:
      return {
        recommendation: "Keep this standard on the next call.",
        impact:
          "Every scored dimension reached full marks. Repeat the same level of evidence-backed coaching.",
      };
  }
}

function recommendationMatchesTheme(recommendation: string, theme: LeverageTheme): boolean {
  const rec = recommendation.toLowerCase();
  if (theme === "live-booking") {
    return /book(ing)? the next call|book(ed)? live|calendar invite/.test(rec);
  }
  if (theme === "accountability-loop") {
    return (
      (/book(ing)? the next call|book(ed)? live|calendar invite|schedule/.test(
        rec,
      ) &&
        /accountab|continuit|close the loop|owner|deadline|confirm/.test(rec)) ||
      /book(ing)? the next call before/.test(rec)
    );
  }
  if (theme === "vision") {
    return /vision|training block|long-term|program focus/.test(rec);
  }
  if (theme === "north-star") {
    return /north star|30-day|emotional why/.test(rec);
  }
  if (theme === "largest-gap") {
    return true;
  }
  return false;
}

function oneThingMatchesTopGap(
  result: EvaluationResult,
  recommendation: string,
): boolean {
  const top = topMissedDimension(result);
  if (!top) return true;
  const rec = recommendation.toLowerCase();
  switch (top.id) {
    case "d6":
    case "d7":
      return /accountab|continuity|deliverable|check-in|close the loop|anchor/i.test(
        rec,
      );
    case "d3":
      return /vision|training block|program focus|long-term/i.test(rec);
    case "d5":
      return /adjust|strategy|long game|protect/i.test(rec);
    case "d10":
      return /book|next call|calendar|locked/i.test(rec);
    case "d11":
      return /continuity|follow-up|follow up/i.test(rec);
    case "d9":
      return (
        /close the loop|confirm|diagnostic|upload|what to do|by when/i.test(rec) &&
        !RAISE_BEFORE_CALL_RE.test(rec)
      );
    default:
      return rec.includes(top.name.toLowerCase().slice(0, 12));
  }
}

export function refineOneThing(result: EvaluationResult): OneThing {
  const theme = resolveLeverageTheme(result);
  const derived = copyForTheme(theme, result);
  const current = result.oneThing;
  const rec = hideInternalIds(current.recommendation || "");
  const impact = hideInternalIds(current.impact || "");
  const projection = computeScoreIfApplied(result);

  const keepModel =
    derived &&
    rec.length >= 12 &&
    !LOW_LEVERAGE_ONE_THING.test(rec) &&
    !RAISE_BEFORE_CALL_RE.test(rec) &&
    recommendationMatchesTheme(rec, theme) &&
    oneThingMatchesTopGap(result, rec);

  const allFull = scoredDimensions(result).every((d) => d.score === d.maxScore);
  if (theme === "none" && allFull && derived) {
    return {
      ...current,
      recommendation: derived.recommendation,
      impact: derived.impact,
      scoreIfApplied: projection.scoreIfApplied,
      scoreIfAppliedBasis: projection.scoreIfAppliedBasis,
    };
  }

  if (keepModel) {
    return {
      ...current,
      recommendation: rec.endsWith(".") ? rec : `${rec}.`,
      impact:
        !impact || GENERIC_IMPACT.test(impact)
          ? derived?.impact ?? impact
          : impact,
      scoreIfApplied: projection.scoreIfApplied,
      scoreIfAppliedBasis: projection.scoreIfAppliedBasis,
    };
  }

  if (
    derived &&
    (LOW_LEVERAGE_ONE_THING.test(rec) ||
      RAISE_BEFORE_CALL_RE.test(rec) ||
      !recommendationMatchesTheme(rec, theme) ||
      !oneThingMatchesTopGap(result, rec) ||
      !rec)
  ) {
    return {
      ...current,
      recommendation: derived.recommendation,
      impact: derived.impact,
      scoreIfApplied: projection.scoreIfApplied,
      scoreIfAppliedBasis: projection.scoreIfAppliedBasis,
    };
  }

  return {
    ...current,
    recommendation: rec.endsWith(".") || !rec ? rec : `${rec}.`,
    impact:
      !impact || GENERIC_IMPACT.test(impact)
        ? derived?.impact ?? impact
        : impact,
    scoreIfApplied: projection.scoreIfApplied,
    scoreIfAppliedBasis: projection.scoreIfAppliedBasis,
  };
}

export function applyReportPresentation(
  result: EvaluationResult,
): EvaluationResult {
  const { result: consistent } = repairEvaluationConsistency(result);
  const oneThing = refineOneThing(consistent);
  return {
    ...consistent,
    oneThing,
    brief: hideInternalIds(consistent.brief),
    dimensions: consistent.dimensions.map((dim) => ({
      ...dim,
      rationale: hideInternalIds(dim.rationale),
      disabledReason: dim.disabledReason
        ? hideInternalIds(dim.disabledReason)
        : dim.disabledReason,
      notApplicableReason: dim.notApplicableReason
        ? hideInternalIds(dim.notApplicableReason)
        : dim.notApplicableReason,
    })),
  };
}

export function evidenceItemLabel(status: string): {
  mark: string;
  label: string;
  hint: string;
} {
  switch (status) {
    case "verified":
      return {
        mark: "✓",
        label: "Verified",
        hint: "Grounded in the original transcript.",
      };
    case "unverified":
      return {
        mark: "⚠",
        label: "Unverified",
        hint: "Proposed evidence could not be found in transcript.",
      };
    case "rejected":
      return {
        mark: "×",
        label: "Rejected",
        hint: "Rejected evidence does not support scoring.",
      };
    default:
      return {
        mark: "—",
        label: "Not demonstrated",
        hint: "Insufficient evidence that the behavior occurred.",
      };
  }
}

export function whyNotFullMarksCopy(dim: DimensionResult): string | null {
  if (
    dim.disabled ||
    dim.notApplicable ||
    dim.score === null ||
    dim.score >= dim.maxScore
  ) {
    return null;
  }
  const text = dim.whyNotFullMarks?.trim();
  return text || null;
}

export function scoreExplanation(dim: DimensionResult): string {
  const na = notApplicableCopy(dim);
  if (na) return na.explanation;

  let text = hideInternalIds(dim.rationale.trim());
  text = text.replace(/\s*\[Verification:[^\]]*\]/g, "").trim();
  text = text.replace(
    /^scored\s+\d+(?:\.\d+)?\s*\/\s*\d+\s*(?:because\s+)?/i,
    "",
  );
  if (/^because\s+/i.test(text)) {
    text = text.replace(/^because\s+/i, "");
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  const onlyUnverified =
    dim.verifiedEvidenceCount === 0 &&
    dim.rejectedEvidenceCount > 0 &&
    !dim.notDemonstrated;
  if (
    onlyUnverified &&
    /\b(the client|they|he|she)\b.{0,40}\b(clearly )?(stated|named|established|confirmed|shared|said)\b/i.test(
      text,
    )
  ) {
    return "The transcript does not provide sufficient verified evidence for the claimed behaviour.";
  }

  return text;
}
