/**
 * Merit-first scoring and two-step auto-cap application for kick-off calls.
 * Score content quality first, then clamp if a global cap applies.
 */

import type {
  AutoCap,
  DimensionResult,
  FiredCap,
  Rubric,
  RubricDimension,
} from "@/lib/rubrics/types";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import { kickoffHasDeepWhyElite } from "@/lib/scoring/eliteBar";

export interface GlobalCapStatus {
  id: string;
  condition: string;
  fired: boolean;
  effect: string;
}

export function scoreFitsRubricBand(
  score: number,
  dimension: RubricDimension,
  rubricId: Rubric["id"],
): boolean {
  if (dimension.discreteScores?.length) {
    return dimension.discreteScores.includes(score);
  }

  const inBand = dimension.bands.some(
    (band) => score >= band.min && score <= band.max,
  );
  if (inBand) return true;

  if (rubricId === "kickoff" && dimension.maxScore <= 5) {
    const snapped = Math.round(score * 2) / 2;
    return dimension.bands.some(
      (band) => snapped >= band.min && snapped <= band.max,
    );
  }

  return false;
}

/** D4 content score from transcript before the no-North-Star cap. */
export function kickoffDeepWhyMeritScore(transcript: string): number {
  if (kickoffHasDeepWhyElite(transcript)) return 15;

  const whyProbe =
    /why is that important|how would that impact|what would happen if nothing changes|what i hear you saying|how would that change/i.test(
      transcript,
    );
  const emotionalDepth =
    /family|legacy|identity|self-image|fear|emotion|more than just the foot|whole —/i.test(
      transcript,
    );
  const statedBack =
    /what i(?:'m| am) hearing|north star|stated back|that's exactly/i.test(
      transcript,
    );

  if (whyProbe && (emotionalDepth || statedBack)) return 10;

  const goalAsk =
    /what(?:'re| are) you hoping|what(?:'s| is) the (?:goal|actual goal)|what are your goals|what are you hoping to get/i.test(
      transcript,
    );
  const surfaceGoal =
    /walk pain|pain free|lose weight|more flexible|be healthy|plantar|without the pain/i.test(
      transcript,
    );

  if (goalAsk && surfaceGoal && !whyProbe) return 5;
  if (!goalAsk && !surfaceGoal) return 0;
  return 5;
}

/** D10 content score from transcript band table (Fail vs Mid vs Elite). */
export function kickoffBookingMeritScore(transcript: string): number {
  if (hasLiveNextCallBooking(transcript)) return 5;

  const mentioned =
    /next call|follow[- ]?up call|check in after|pick a date|schedule|book(?:ing)?/i.test(
      transcript,
    );
  if (!mentioned) return 0;

  const deferred =
    /assistant handles|send you a link|reach out to you|grab whatever works|organize via message|later this week or early next/i.test(
      transcript,
    );
  if (deferred) return 3;

  const weak =
    /usually like to check in|we'll figure it out|talk soon/i.test(transcript);
  if (weak) return 1.5;

  return 2.5;
}

export function buildCapNote(args: {
  meritScore: number;
  finalScore: number;
  maxScore: number;
  capLabel: string;
  capMax?: number;
}): string {
  const { meritScore, finalScore, maxScore, capLabel, capMax } = args;
  if (capMax !== undefined && meritScore > capMax && finalScore === capMax) {
    return `Scored ${meritScore}/${maxScore} on content; capped at ${capMax}/${maxScore} by the ${capLabel}.`;
  }
  if (meritScore === finalScore) {
    if (capMax !== undefined && meritScore <= capMax) {
      return `Scored ${meritScore}/${maxScore} on content; cap at ${capMax}/${maxScore} did not apply.`;
    }
    return `Scored ${meritScore}/${maxScore} on content.`;
  }
  return `Scored ${meritScore}/${maxScore} on content; final score ${finalScore}/${maxScore}.`;
}

type WorkingDim = DimensionResult & {
  meritScore?: number | null;
  capNote?: string | null;
};

/** Apply merit-first scoring for kickoff D4 and D10. Never raises except D10 Fail→Mid correction. */
export function applyKickoffMeritScoring(
  dimensions: WorkingDim[],
  transcript: string,
): void {
  const d4 = dimensions.find((d) => d.id === "d4");
  if (d4 && !d4.disabled && !d4.notApplicable && d4.score !== null) {
    const merit = kickoffDeepWhyMeritScore(transcript);
    d4.meritScore = merit;
    if (d4.score > merit) d4.score = merit;
  }

  const d10 = dimensions.find((d) => d.id === "d10");
  if (d10 && !d10.disabled && !d10.notApplicable && d10.score !== null) {
    const merit = kickoffBookingMeritScore(transcript);
    d10.meritScore = merit;
    if (d10.score === 0 && merit >= 2.5) {
      d10.score = merit;
    } else if (d10.score > merit) {
      d10.score = merit;
    }
  }
}

/** Attach capNote after auto-caps run. */
export function attachKickoffCapNotes(
  dimensions: WorkingDim[],
  rubric: Rubric,
  firedCapIds: Set<string>,
): void {
  if (rubric.id !== "kickoff") return;

  const d4 = dimensions.find((d) => d.id === "d4");
  if (d4 && d4.score !== null && d4.meritScore != null) {
    const cap = rubric.autoCaps.find((c) => c.id === "no-north-star");
    const capMax = cap?.maxDimensionScore;
    d4.capNote = buildCapNote({
      meritScore: d4.meritScore,
      finalScore: d4.score,
      maxScore: d4.maxScore,
      capLabel: "no-North-Star rule",
      capMax: firedCapIds.has("no-north-star") ? capMax : undefined,
    });
  }

  const d10 = dimensions.find((d) => d.id === "d10");
  if (d10 && d10.score !== null && d10.meritScore != null) {
    d10.capNote = buildCapNote({
      meritScore: d10.meritScore,
      finalScore: d10.score,
      maxScore: d10.maxScore,
      capLabel: "live-booking rule",
    });
  }
}

export const KICKOFF_AUTO_CAPS: AutoCap[] = [
  {
    id: "no-follow-ups",
    condition: "No follow-up questions anywhere in the call",
    maxTotal: 70,
  },
  {
    id: "coach-monologue",
    condition: "Coach speaks >70% of the time without client engagement",
    maxTotal: 80,
  },
  {
    id: "unresolved-confusion",
    condition: "Client shows unresolved confusion at any point",
    maxTotal: 75,
  },
  {
    id: "no-north-star",
    condition: "No North Star statement constructed",
    dimensionId: "d4",
    maxDimensionScore: 10,
  },
];

export function globalCapsAudit(
  autoCaps: AutoCap[],
  firedCapIds: Iterable<string>,
): GlobalCapStatus[] {
  const fired = new Set(firedCapIds);
  return autoCaps.map((cap) => {
    const isFired = fired.has(cap.id);
    let effect = "Did not fire.";
    if (isFired) {
      if (cap.maxTotal !== undefined) {
        effect = `Total capped at ${cap.maxTotal}.`;
      } else if (cap.dimensionId && cap.maxDimensionScore !== undefined) {
        effect = `${cap.dimensionId} max ${cap.maxDimensionScore}.`;
      } else if (cap.forceDimensionScore !== undefined) {
        effect = `${cap.dimensionId} forced to ${cap.forceDimensionScore}.`;
      }
    }
    return {
      id: cap.id,
      condition: cap.condition,
      fired: isFired,
      effect,
    };
  });
}

export function capNoteForDimension(dim: DimensionResult): string | null {
  return dim.capNote?.trim() || null;
}

export function enrichFiredCapEffects(
  firedCaps: FiredCap[],
  dimensions: DimensionResult[],
): FiredCap[] {
  const d4 = dimensions.find((d) => d.id === "d4");
  return firedCaps.map((cap) => {
    if (cap.id !== "no-north-star" || !d4?.capNote) return cap;
    return { ...cap, effect: d4.capNote };
  });
}
