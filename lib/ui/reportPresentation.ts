import type {
  DimensionResult,
  EvaluationResult,
  FiredCap,
  OneThing,
} from "@/lib/rubrics/types";
import {
  computeScoreIfApplied,
  resolveLeverageTheme,
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
          ? "Diagnostics review did not occur in this cycle, so this dimension was not scored."
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
      return "High impact";
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

function strengthPhrase(full: DimensionResult[], callType: string): string | null {
  if (full.length === 0) return null;

  if (callType === "coaching") {
    const ids = new Set(full.map((d) => d.id));
    const connection = ids.has("d1");
    const instincts = ids.has("d8") || ids.has("d9");
    const structure = ids.has("d12");
    const parts: string[] = [];
    if (connection && instincts) {
      parts.push("Strong connection and coaching instincts");
    } else if (connection) {
      parts.push("Strong client connection");
    } else if (instincts) {
      parts.push("Strong coaching instincts");
    }
    if (structure && !connection) parts.push("clear session structure");
    if (parts.length > 0) return parts.join(", with ");
  }

  if (callType === "kickoff") {
    const ids = new Set(full.map((d) => d.id));
    if (ids.has("d2") && ids.has("d4")) {
      return "Strong rapport and goal alignment";
    }
    if (ids.has("d2")) return "Strong client connection";
    if (ids.has("d1")) return "Clear preparation";
  }

  const names = full.slice(0, 2).map((d) => d.name.toLowerCase());
  return `Strong ${joinHuman(names)}`;
}

export function scoreHeadline(result: EvaluationResult): string {
  const scored = scoredDimensions(result);
  const full = scored.filter((d) => d.score === d.maxScore);
  const missed = scored
    .filter(isMissed)
    .sort((a, b) => gapOf(b) - gapOf(a) || a.name.localeCompare(b.name));

  if (missed.length === 0) {
    return "Every scored dimension reached full marks on this call.";
  }

  const gaps = uniquePhrases(
    missed.slice(0, 4).map((d) => gapPhrase(d, result.callType)),
  ).slice(0, 3);
  const strength = strengthPhrase(full, result.callType);

  if (!strength) {
    return `The score was held back by ${joinHuman(gaps)}.`;
  }
  return `${strength}, with meaningful gaps in ${joinHuman(gaps)}.`;
}

function hasUnverifiedOnly(dim: DimensionResult): boolean {
  return dim.verifiedEvidenceCount === 0 && dim.rejectedEvidenceCount > 0;
}

export function briefSections(result: EvaluationResult): BriefSections {
  const scored = scoredDimensions(result);
  const full = scored.filter((d) => d.score === d.maxScore);
  const missed = scored
    .filter(isMissed)
    .sort((a, b) => gapOf(b) - gapOf(a) || a.name.localeCompare(b.name));

  const well =
    full.length === 0
      ? "No scored dimension reached full marks on this call."
      : `Strong ${joinHuman(
          uniquePhrases(
            full.slice(0, 3).map((d) => {
              if (result.callType === "coaching" && d.id === "d1") {
                return "client connection";
              }
              if (d.id === "d8") return "struggle handling";
              if (d.id === "d12") return "session structure";
              if (result.callType === "coaching" && d.id === "d9") {
                return "close quality";
              }
              return d.name.toLowerCase();
            }),
          ),
        )}.`;

  const heldParts = missed.slice(0, 3).map((d) => {
    if (d.id === "d3" && hasUnverifiedOnly(d)) {
      return "a clearly verified long-term vision";
    }
    return gapPhrase(d, result.callType);
  });
  const held =
    missed.length === 0
      ? "Nothing material held this score back."
      : `The session lacked ${joinHuman(uniquePhrases(heldParts))}.`;

  const refined = refineOneThing(result);
  return {
    well,
    held,
    next: hideInternalIds(firstSentence(refined.recommendation)).replace(
      /\.?$/,
      ".",
    ),
  };
}

function copyForTheme(
  theme: LeverageTheme,
  result: EvaluationResult,
): { recommendation: string; impact: string } | null {
  switch (theme) {
    case "accountability-loop":
      return {
        recommendation: "Close the loop on accountability and continuity.",
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
      const missed = scoredDimensions(result)
        .filter(isMissed)
        .sort((a, b) => gapOf(b) - gapOf(a));
      const top = missed[0];
      if (!top) return null;
      return {
        recommendation: `Raise ${top.name} before the next call.`,
        impact: `This was the largest meaningful score gap on this evaluation, and closing it would most improve the client experience.`,
      };
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
    return /accountab|continuit|close the loop|book the next call|owner|deadline/.test(
      rec,
    );
  }
  if (theme === "vision") {
    return /vision|training block|long-term/.test(rec);
  }
  if (theme === "north-star") {
    return /north star|30-day|emotional why/.test(rec);
  }
  return false;
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
    recommendationMatchesTheme(rec, theme);

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

  if (derived && (LOW_LEVERAGE_ONE_THING.test(rec) || !recommendationMatchesTheme(rec, theme) || !rec)) {
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
  return {
    ...result,
    oneThing: refineOneThing(result),
    brief: hideInternalIds(result.brief),
    redFlags: result.redFlags.map((flag) => ({
      ...flag,
      title: hideInternalIds(flag.title),
      explanation: hideInternalIds(flag.explanation),
      evidence: hideInternalIds(flag.evidence),
    })),
    dimensions: result.dimensions.map((dim) => ({
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
        hint: "Evidence appears in transcript.",
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
        hint: "Evidence was rejected and should not support the score.",
      };
    default:
      return {
        mark: "—",
        label: "Not demonstrated",
        hint: "Insufficient evidence that the behavior occurred.",
      };
  }
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
