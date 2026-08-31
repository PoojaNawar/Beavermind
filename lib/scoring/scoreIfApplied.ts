import type {
  CallType,
  DimensionResult,
  EvaluationResult,
  GradeBand,
} from "@/lib/rubrics/types";

/**
 * Client-safe scoring helpers.
 * Do NOT import @/lib/rubrics (or loadMarkdown / fs) from this module —
 * it is used by the report UI in the browser.
 */

function normalizeToHundred(rawScore: number, scoreOutOf: number): number {
  if (scoreOutOf === 100) return Math.round(rawScore);
  return Math.round((rawScore / scoreOutOf) * 100);
}

/** Shared grade thresholds for both rubrics (Elite 90–100 … Fail 0–59). */
function gradeFromHundred(score: number): GradeBand {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Inconsistent";
  if (score >= 60) return "At risk";
  return "Fail";
}

/**
 * Total-score auto-caps from the typed rubrics, keyed for client use
 * without reading markdown/fs.
 */
function totalCapMax(callType: CallType, capId: string): number | undefined {
  if (capId === "no-follow-ups") return 70;
  if (capId === "unresolved-confusion") return 75;
  if (capId === "no-action-steps") return 70;
  if (capId === "coach-monologue") {
    return callType === "kickoff" ? 80 : 75;
  }
  return undefined;
}

/**
 * Coaching manager skim: Connection · Confidence · Continuity.
 * Mapped from the rubric's three-pillar framing (not internal dimension IDs).
 */
export type PillarId = "connection" | "confidence" | "continuity";

export type PillarSummary = {
  id: PillarId;
  name: string;
  earned: number;
  available: number;
  /** 0–1 when available > 0 */
  ratio: number | null;
  tone: "good" | "mid" | "bad" | "muted";
  weakest: { name: string; score: number; maxScore: number } | null;
  dragged: boolean;
};

const COACHING_PILLARS: {
  id: PillarId;
  name: string;
  dimensionIds: string[];
}[] = [
  {
    id: "connection",
    name: "Connection",
    dimensionIds: ["d1", "d2", "d8"],
  },
  {
    id: "confidence",
    name: "Confidence",
    dimensionIds: ["d3", "d4", "d5", "d9", "d12"],
  },
  {
    id: "continuity",
    name: "Continuity",
    dimensionIds: ["d6", "d7", "d10", "d11"],
  },
];

function pillarTone(ratio: number | null): PillarSummary["tone"] {
  if (ratio === null) return "muted";
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.5) return "mid";
  return "bad";
}

function activeDims(
  result: EvaluationResult,
  ids: string[],
): DimensionResult[] {
  return ids
    .map((id) => result.dimensions.find((d) => d.id === id))
    .filter((d): d is DimensionResult => {
      if (!d) return false;
      if (d.disabled || d.notApplicable || d.score === null) return false;
      return true;
    });
}

export function coachingPillars(result: EvaluationResult): PillarSummary[] {
  if (result.callType !== "coaching") return [];

  const pillars = COACHING_PILLARS.map((def) => {
    const dims = activeDims(result, def.dimensionIds);
    let earned = 0;
    let available = 0;
    let weakest: PillarSummary["weakest"] = null;

    for (const dim of dims) {
      earned += dim.score!;
      available += dim.maxScore;
      const gap = dim.maxScore - dim.score!;
      if (gap <= 0) continue;
      const ratio = dim.score! / dim.maxScore;
      if (!weakest) {
        weakest = {
          name: dim.name,
          score: dim.score!,
          maxScore: dim.maxScore,
        };
        continue;
      }
      const weakGap = weakest.maxScore - weakest.score;
      const weakRatio = weakest.score / weakest.maxScore;
      const worseGap = gap > weakGap;
      const sameGapWorseRatio = gap === weakGap && ratio < weakRatio;
      const sameGapZero =
        gap === weakGap &&
        ratio === weakRatio &&
        dim.score === 0 &&
        weakest.score > 0;
      if (worseGap || sameGapWorseRatio || sameGapZero) {
        weakest = {
          name: dim.name,
          score: dim.score!,
          maxScore: dim.maxScore,
        };
      }
    }

    const ratio = available > 0 ? earned / available : null;
    return {
      id: def.id,
      name: def.name,
      earned,
      available,
      ratio,
      tone: pillarTone(ratio),
      weakest,
      dragged: false,
    };
  }).filter((p) => p.available > 0);

  if (pillars.length === 0) return pillars;

  const worstRatio = Math.min(...pillars.map((p) => p.ratio ?? 1));
  return pillars.map((p) => ({
    ...p,
    dragged: p.ratio !== null && p.ratio === worstRatio && p.ratio < 0.8,
  }));
}

export type LeverageTheme =
  | "accountability-loop"
  | "live-booking"
  | "vision"
  | "north-star"
  | "largest-gap"
  | "none";

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

/** When gaps tie, prefer continuity/accountability gaps over vision for coaching. */
const COACHING_GAP_PRIORITY = [
  "d6",
  "d7",
  "d11",
  "d5",
  "d3",
  "d1",
  "d8",
  "d9",
  "d12",
  "d10",
];

function coachingGapPriority(id: string): number {
  const idx = COACHING_GAP_PRIORITY.indexOf(id);
  return idx >= 0 ? idx : 99;
}

/** Largest point gap; ties break on lowest score ratio, then dimension id. */
export function topMissedDimension(
  result: EvaluationResult,
): DimensionResult | undefined {
  const missed = result.dimensions.filter(isMissed);
  if (missed.length === 0) return undefined;
  return [...missed].sort((a, b) => {
    const gapDiff = gapOf(b) - gapOf(a);
    if (gapDiff !== 0) return gapDiff;
    const ratioA = a.score! / a.maxScore;
    const ratioB = b.score! / b.maxScore;
    if (ratioA !== ratioB) return ratioA - ratioB;
    if (result.callType === "coaching") {
      return coachingGapPriority(a.id) - coachingGapPriority(b.id);
    }
    return a.id.localeCompare(b.id);
  })[0];
}

function dimById(result: EvaluationResult, id: string) {
  return result.dimensions.find((d) => d.id === id);
}

export function resolveLeverageTheme(result: EvaluationResult): LeverageTheme {
  if (result.callType === "coaching") {
    const d6 = dimById(result, "d6");
    const d7 = dimById(result, "d7");
    const d10 = dimById(result, "d10");
    const d11 = dimById(result, "d11");
    const bookingMissed = Boolean(d10 && isMissed(d10) && d10.score === 0);
    const bookingCapped = result.firedCaps.some(
      (c) => c.id === "next-call-not-booked",
    );
    const cluster = [d6, d7, d11].filter((d): d is DimensionResult =>
      Boolean(d && isMissed(d)),
    );

    if ((bookingMissed || bookingCapped) && cluster.length >= 1) {
      return "accountability-loop";
    }
    if (bookingMissed || bookingCapped) return "live-booking";

    const missed = result.dimensions.filter(isMissed);
    if (missed.length === 0) return "none";

    const largest = topMissedDimension(result);
    if (
      result.firedCaps.some((c) => c.id === "no-long-term-vision") &&
      largest?.id === "d3"
    ) {
      return "vision";
    }
    if (
      largest?.id === "d3" &&
      !missed.some((d) => d.id !== "d3" && gapOf(d) >= gapOf(largest))
    ) {
      return "vision";
    }
    return "largest-gap";
  }

  if (result.callType === "kickoff") {
    const missed = result.dimensions.filter(isMissed);
    if (missed.length === 0) return "none";
    const d10 = dimById(result, "d10");
    if (d10 && isMissed(d10) && d10.score === 0) return "live-booking";
    if (result.firedCaps.some((c) => c.id === "no-north-star")) {
      return "north-star";
    }
    const d4 = dimById(result, "d4");
    const largest = topMissedDimension(result);
    if (d4 && isMissed(d4) && largest?.id === "d4") return "north-star";
    return "largest-gap";
  }

  const missed = result.dimensions.filter(isMissed);
  if (missed.length === 0) return "none";
  if (result.firedCaps.some((c) => c.id === "no-north-star")) return "north-star";
  const d4 = dimById(result, "d4");
  const largest = topMissedDimension(result);
  if (d4 && isMissed(d4) && largest?.id === "d4") return "north-star";
  return "largest-gap";
}

/**
 * Dimension targets if The One Thing were applied.
 * Assumes the related rubric constraint is also fixed (e.g. live booking).
 */
export function oneThingLiftTargets(
  result: EvaluationResult,
  theme: LeverageTheme = resolveLeverageTheme(result),
): Map<string, number> {
  const lifts = new Map<string, number>();
  const take = (id: string) => {
    const dim = dimById(result, id);
    if (!dim || dim.disabled || dim.notApplicable || dim.score === null) return;
    if (dim.score >= dim.maxScore) return;
    lifts.set(id, dim.maxScore);
  };

  switch (theme) {
    case "accountability-loop":
      take("d6");
      take("d7");
      take("d10");
      take("d11");
      break;
    case "live-booking":
      take("d10");
      break;
    case "vision":
      take("d3");
      break;
    case "north-star":
      take("d4");
      break;
    case "largest-gap": {
      const top = topMissedDimension(result);
      if (top) lifts.set(top.id, top.maxScore);
      break;
    }
    default:
      break;
  }

  return lifts;
}

function humanBasis(result: EvaluationResult, lifts: Map<string, number>): string {
  const names = [...lifts.keys()]
    .map((id) => dimById(result, id)?.name)
    .filter((n): n is string => Boolean(n));
  const suffix =
    "Illustrative projection based on the current dimension score.";
  if (names.length === 0) {
    return "No additional points are available from The One Thing.";
  }
  if (names.length === 1) {
    return `Assumes ${names[0]} reaches full marks. ${suffix}`;
  }
  if (names.length === 2) {
    return `Assumes ${names[0]} and ${names[1]} reach full marks. ${suffix}`;
  }
  return `Assumes ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} reach full marks. ${suffix}`;
}

/**
 * Backend-owned projection: same calculator as the final score.
 * Never trusts the model's estimatedPointsGained.
 * Safe for client bundles (no fs / rubric markdown).
 */
export function computeScoreIfApplied(result: EvaluationResult): {
  scoreIfApplied: number | null;
  scoreIfAppliedBasis: string;
} {
  const theme = resolveLeverageTheme(result);
  const lifts = oneThingLiftTargets(result, theme);

  if (lifts.size === 0) {
    return {
      scoreIfApplied: null,
      scoreIfAppliedBasis:
        theme === "none"
          ? "Already at full marks on every scored dimension."
          : "No additional points are available from The One Thing.",
    };
  }

  let raw = 0;
  let available = 0;
  for (const dim of result.dimensions) {
    if (dim.disabled || dim.notApplicable || dim.score === null) continue;
    available += dim.maxScore;
    raw += lifts.get(dim.id) ?? dim.score;
  }

  // Total caps independent of The One Thing still apply.
  let cappedRaw = raw;
  for (const cap of result.firedCaps) {
    if (
      cap.id === "next-call-not-booked" ||
      cap.id === "no-long-term-vision" ||
      cap.id === "no-north-star" ||
      cap.id === "no-accountability-commitment" ||
      cap.id === "no-action-steps"
    ) {
      continue;
    }
    const maxTotal = totalCapMax(result.callType, cap.id);
    if (maxTotal === undefined) continue;
    const scaled = Math.round((maxTotal / 100) * (available || 100));
    if (cappedRaw > scaled) cappedRaw = scaled;
  }

  const scoreIfApplied = normalizeToHundred(cappedRaw, available || 100);
  if (scoreIfApplied <= result.overallScore) {
    return {
      scoreIfApplied: null,
      scoreIfAppliedBasis:
        "The projected total would not rise under the current rubric constraints.",
    };
  }

  return {
    scoreIfApplied,
    scoreIfAppliedBasis: humanBasis(result, lifts),
  };
}

export function projectedGrade(score: number): GradeBand {
  return gradeFromHundred(score);
}
