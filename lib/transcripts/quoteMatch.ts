/**
 * Normalized-string quote matching against the original transcript.
 *
 * WHY this is not semantic: we cannot treat paraphrase or invented wording as
 * transcript proof. VERIFIED requires the proposed excerpt to actually appear.
 * Prefix/head matching is intentionally omitted — it would accept altered quotes.
 */

const NOT_DEMONSTRATED_PLACEHOLDER =
  /not demonstrated|none found|no evidence|absent from (the )?transcript/i;

export function isNotDemonstratedPlaceholder(quote: string): boolean {
  return NOT_DEMONSTRATED_PLACEHOLDER.test(quote);
}

export function normalizeForQuoteMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteExistsInTranscript(
  quote: string,
  transcript: string,
): boolean {
  if (!quote || isNotDemonstratedPlaceholder(quote)) {
    return true;
  }
  const q = normalizeForQuoteMatch(quote);
  if (!q) return false;
  const t = normalizeForQuoteMatch(transcript);
  return t.includes(q);
}
