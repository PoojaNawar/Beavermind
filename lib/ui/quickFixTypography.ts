/**
 * Quick Fix text hygiene. Display can use a real arrow; PDF Helvetica cannot.
 * Canonical stored form is ASCII " -> ".
 */
const UNICODE_ARROWS = /[→⟶➔➜➡︎▸►]/g;

export function sanitizeQuickFixTypography(text: string): string {
  let s = text.normalize("NFC").replace(/\u0000/g, "");
  s = s.replace(/â†’|â†'|â€º|\u00e2\u20ac\u00ba/g, "->");
  s = s.replace(UNICODE_ARROWS, "->");
  s = s.replace(/\s*!['\u2018\u2019]\s*/g, " -> ");
  s = s.replace(/\s*-+>\s*/g, " -> ");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/,{2,}/g, ",");
  s = s.replace(/\s+([.,;:])/g, "$1");
  return s.trim();
}

export function quickFixForDisplay(text: string): string {
  return sanitizeQuickFixTypography(text).replace(/ -> /g, " → ");
}

export function quickFixForPdf(text: string): string {
  return sanitizeQuickFixTypography(text).replace(UNICODE_ARROWS, "->");
}
