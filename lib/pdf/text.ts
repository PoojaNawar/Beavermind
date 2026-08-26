/**
 * Helvetica (WinAnsi) cannot encode smart quotes, em dashes, arrows, or emoji.
 * PDFKit throws on those, which surfaced as a generic "could not be completed" on Download PDF.
 */
export function pdfSafeText(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFKC").replace(/\u0000/g, "");
  s = s.replace(/[“”„‟«»]/g, '"');
  s = s.replace(/[‘’‚‛]/g, "'");
  s = s.replace(/[—–−‑]/g, "-");
  s = s.replace(/[→⟶➔➜➡︎▸►]/g, "->");
  s = s.replace(/[•●‣]/g, "*");
  s = s.replace(/[·∙]/g, " | ");
  s = s.replace(/…/g, "...");
  s = s.replace(/[⚠⚠️]/g, "");
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/[\u2000-\u200B\u2028\u2029\uFEFF]/g, " ");
  s = s.replace(/[^\t\n\r\x20-\x7E]/g, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}
