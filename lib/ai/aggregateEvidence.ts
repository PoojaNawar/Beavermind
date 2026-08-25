import { z } from "zod";
import { normalizeForQuoteMatch } from "@/lib/transcripts/quoteMatch";

export const chunkEvidenceQuoteSchema = z.object({
  quote: z.string(),
  speaker: z.string().nullable(),
  location: z.string().nullable(),
});

export const chunkFindingSchema = z.object({
  dimensionId: z.string(),
  quotes: z.array(chunkEvidenceQuoteSchema),
  observations: z.string(),
});

export const chunkEvidencePackSchema = z.object({
  chunkIndex: z.number(),
  findings: z.array(chunkFindingSchema),
});

export type ChunkEvidencePack = z.infer<typeof chunkEvidencePackSchema>;

export interface AggregatedQuote {
  quote: string;
  speaker: string | null;
  location: string | null;
  chunkIndex: number;
}

export interface AggregatedDimensionEvidence {
  dimensionId: string;
  quotes: AggregatedQuote[];
  observations: string[];
}

const NOT_DEMONSTRATED_RE =
  /not demonstrated|none found|no evidence|absent|not present|not in this chunk/i;

function normalizeQuote(quote: string): string {
  return normalizeForQuoteMatch(quote);
}

function quotesAreNearDuplicate(a: string, b: string): boolean {
  const na = normalizeQuote(a);
  const nb = normalizeQuote(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 20) {
    const headLen = Math.min(40, minLen);
    const ha = na.slice(0, headLen);
    const hb = nb.slice(0, headLen);
    if (na.includes(hb) || nb.includes(ha)) return true;
  }
  return false;
}

function isSubstantiveQuote(quote: string): boolean {
  const trimmed = quote.trim();
  if (!trimmed) return false;
  if (NOT_DEMONSTRATED_RE.test(trimmed)) return false;
  return normalizeQuote(trimmed).length >= 8;
}

/**
 * Deterministic evidence aggregation — no LLM merge pass.
 *
 * WHY no second model call: merging must not invent or "improve" quotes.
 * Chunk packs are grouped by dimension id, identical/near-duplicate quotes
 * are dropped, and remaining excerpts stay in chunk order.
 */
export function aggregateEvidencePacks(
  packs: ChunkEvidencePack[],
  maxQuotesPerDimension = 5,
): AggregatedDimensionEvidence[] {
  const byDimension = new Map<string, AggregatedDimensionEvidence>();

  const sorted = [...packs].sort((a, b) => a.chunkIndex - b.chunkIndex);

  for (const pack of sorted) {
    for (const finding of pack.findings) {
      const dimId = finding.dimensionId.toLowerCase();
      let entry = byDimension.get(dimId);
      if (!entry) {
        entry = { dimensionId: dimId, quotes: [], observations: [] };
        byDimension.set(dimId, entry);
      }

      if (finding.observations.trim()) {
        const obs = finding.observations.trim();
        const isDuplicateObs = entry.observations.some(
          (o) => normalizeQuote(o) === normalizeQuote(obs),
        );
        if (!isDuplicateObs) {
          entry.observations.push(
            `[chunk ${pack.chunkIndex}] ${obs}`,
          );
        }
      }

      for (const q of finding.quotes) {
        if (!isSubstantiveQuote(q.quote)) continue;
        const isDupe = entry.quotes.some((existing) =>
          quotesAreNearDuplicate(existing.quote, q.quote),
        );
        if (isDupe) continue;

        entry.quotes.push({
          quote: q.quote,
          speaker: q.speaker,
          location: q.location ?? `chunk ${pack.chunkIndex}`,
          chunkIndex: pack.chunkIndex,
        });
      }
    }
  }

  for (const entry of byDimension.values()) {
    entry.quotes.sort((a, b) => a.chunkIndex - b.chunkIndex);
    if (entry.quotes.length > maxQuotesPerDimension) {
      entry.quotes = entry.quotes.slice(0, maxQuotesPerDimension);
    }
  }

  return [...byDimension.values()].sort((a, b) =>
    a.dimensionId.localeCompare(b.dimensionId),
  );
}

/** Format aggregated evidence for the synthesis prompt. */
export function formatAggregatedEvidence(
  aggregated: AggregatedDimensionEvidence[],
): string {
  if (aggregated.length === 0) {
    return "(No evidence extracted from transcript chunks.)";
  }

  return aggregated
    .map((dim) => {
      const quoteLines =
        dim.quotes.length > 0
          ? dim.quotes
              .map(
                (q) =>
                  `  - [chunk ${q.chunkIndex}${q.speaker ? `, ${q.speaker}` : ""}] "${q.quote}"`,
              )
              .join("\n")
          : "  - (no substantive quotes)";

      const obsLines =
        dim.observations.length > 0
          ? `\n  Observations:\n${dim.observations.map((o) => `  - ${o}`).join("\n")}`
          : "";

      return `## ${dim.dimensionId}\nQuotes:\n${quoteLines}${obsLines}`;
    })
    .join("\n\n");
}
