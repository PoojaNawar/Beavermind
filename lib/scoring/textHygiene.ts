const META_COMMENTARY_RE =
  /\bif the score\b|\bdo not treat\b|\bthe rubric requires\b|\bremaining gap\b|\bshould (?:not|be) (?:interpreted|treated) as\b|\bthis is not a\b.{0,20}\brecap\b|\bscoring (?:constraint|note)\b/i;

/** True when coach-facing text leaks scoring mechanics or hedged conditionals. */
export function hasLeakedScoringMechanics(text: string): boolean {
  return META_COMMENTARY_RE.test(text.trim());
}
