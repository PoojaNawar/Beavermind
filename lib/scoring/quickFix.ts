import type {
  DimensionResult,
  Rubric,
  RubricDimension,
} from "@/lib/rubrics/types";
import { sanitizeQuickFixTypography } from "@/lib/ui/quickFixTypography";

const GENERIC_QUICK_FIX =
  /^(improve communication|build( more)? rapport|be more empathetic|do better|try harder|be a better listener|improve your coaching)\.?$/i;

export const FULL_MARKS_QUICK_FIX = "Full marks were reached.";

/**
 * Coach-facing quick fix. Never changes the dimension score.
 *
 * Empty, generic, or copy-pasted model text is replaced with the elite
 * behaviour for that dimension. Full marks keep the existing sentinel.
 */
export function fallbackQuickFix(dimension: RubricDimension): string {
  const fromRubric = dimension.quickFixAction?.trim();
  if (fromRubric) return fromRubric;

  const elite =
    dimension.bands.find((b) => b.name === "Elite") ??
    dimension.bands[dimension.bands.length - 1];
  const target = elite?.criteria ?? dimension.description;
  return `Do this to reach full marks on ${dimension.name}: ${target}`;
}

export function isUnusableQuickFix(
  text: string,
  dimension: RubricDimension,
): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return true;

  const cleaned = sanitizeQuickFixTypography(trimmed);
  const normalized = cleaned.toLowerCase().replace(/\s+/g, " ");
  if (GENERIC_QUICK_FIX.test(normalized)) {
    return true;
  }
  if (
    /^(n\/?a|none|none needed|not applicable|null|undefined|-)$/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  if (
    /full marks were reached|already at full marks|no change needed|no quick fix|not scored on this call/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /missing elite|elite-band|elite band|do the missing|name the missing|from the rubric/i.test(
      normalized,
    )
  ) {
    return true;
  }

  const elite = dimension.bands.find((b) => b.name === "Elite");
  const criteria = elite?.criteria?.trim().toLowerCase();
  if (criteria && criteria.length > 24 && normalized.includes(criteria)) {
    return true;
  }
  if (/^to reach \d+\s*\/\s*\d+\s*:/.test(normalized) && normalized.includes("+")) {
    return true;
  }
  return false;
}

export function resolveQuickFix(args: {
  quickFix: string;
  score: number | null;
  maxScore: number;
  disabled: boolean;
  notApplicable: boolean;
  dimension: RubricDimension;
}): string {
  if (args.disabled || args.notApplicable) {
    return "";
  }

  if (args.score !== null && args.score >= args.maxScore) {
    return FULL_MARKS_QUICK_FIX;
  }

  if (!isUnusableQuickFix(args.quickFix, args.dimension)) {
    return sanitizeQuickFixTypography(args.quickFix);
  }

  return fallbackQuickFix(args.dimension);
}

function keyOf(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isFullMarksDimension(dim: DimensionResult): boolean {
  return (
    !dim.disabled &&
    !dim.notApplicable &&
    dim.score !== null &&
    dim.score >= dim.maxScore
  );
}

/** Same sentence on two missed dimensions is not a real quick fix. */
export function replaceDuplicateQuickFixes(
  dimensions: DimensionResult[],
  rubric: Rubric,
): DimensionResult[] {
  const counts = new Map<string, number>();
  for (const dim of dimensions) {
    if (isFullMarksDimension(dim)) continue;
    const text = dim.quickFix.trim();
    if (!text || text === FULL_MARKS_QUICK_FIX) continue;
    const key = keyOf(text);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const dimById = new Map(rubric.dimensions.map((d) => [d.id, d]));
  return dimensions.map((dim) => {
    if (isFullMarksDimension(dim)) return dim;
    const text = dim.quickFix.trim();
    if (!text) return dim;
    if ((counts.get(keyOf(text)) ?? 0) < 2) return dim;
    const def = dimById.get(dim.id);
    if (!def) return { ...dim, quickFix: "" };
    return { ...dim, quickFix: fallbackQuickFix(def) };
  });
}

export function refreshDimensionQuickFixes(
  dimensions: DimensionResult[],
  rubric: Rubric,
): DimensionResult[] {
  const dimById = new Map(rubric.dimensions.map((d) => [d.id, d]));
  const resolved = dimensions.map((dim) => {
    const def = dimById.get(dim.id);
    if (!def) return dim;
    return {
      ...dim,
      quickFix: resolveQuickFix({
        quickFix: dim.quickFix,
        score: dim.score,
        maxScore: dim.maxScore,
        disabled: dim.disabled,
        notApplicable: dim.notApplicable,
        dimension: def,
      }),
    };
  });
  return replaceDuplicateQuickFixes(resolved, rubric);
}
