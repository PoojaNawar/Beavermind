import type { DimensionResult } from "@/lib/rubrics/types";

export type ScoreTone = "good" | "mid" | "bad" | "muted";

export function dimensionRatio(dim: DimensionResult): number | null {
  if (dim.disabled || dim.notApplicable || dim.score === null || dim.maxScore === 0) {
    return null;
  }
  return dim.score / dim.maxScore;
}

export function dimensionTone(dim: DimensionResult): ScoreTone {
  const ratio = dimensionRatio(dim);
  if (ratio === null) return "muted";
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.5) return "mid";
  return "bad";
}

export function scorePillClass(tone: ScoreTone): string {
  switch (tone) {
    case "good":
      return "bg-[var(--good-soft)] text-[var(--good)]";
    case "mid":
      return "bg-[var(--warn-soft)] text-[#8a6a12]";
    case "bad":
      return "bg-[var(--danger-soft)] text-[var(--danger)]";
    default:
      return "bg-[var(--bg-deep)] text-[var(--muted)]";
  }
}

export function toneFill(tone: ScoreTone): string {
  switch (tone) {
    case "good":
      return "var(--good)";
    case "mid":
      return "var(--warn)";
    case "bad":
      return "var(--danger)";
    default:
      return "var(--line)";
  }
}

export function isHighWeightDimension(dim: DimensionResult): boolean {
  return dim.maxScore >= 10;
}

export function scoredRationale(dim: DimensionResult): string {
  if (dim.disabled || dim.notApplicable || dim.score === null) {
    return dim.rationale;
  }
  const trimmed = dim.rationale.trim();
  if (/^scored\s+\d/i.test(trimmed)) return trimmed;
  const rest = /^because\b/i.test(trimmed)
    ? trimmed
    : `because ${trimmed}`;
  return `Scored ${dim.score}/${dim.maxScore} ${rest}`;
}
