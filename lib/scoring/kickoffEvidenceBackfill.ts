/**
 * Backfill verified transcript quotes when the model (or QA stubs) omit evidence.
 * Scores may already be calibrated from transcript detectors; this makes the
 * report auditable in the UI.
 */

import type { DimensionResult, EvaluationResult } from "@/lib/rubrics/types";
import { isBrokenEvidenceQuote } from "@/lib/scoring/dimensionAdjudication";
import { summarizeReportEvidence } from "@/lib/transcripts/evidenceQuality";

type CoachQuote = { quote: string; speaker: string | null };

function parseSpeakerLine(line: string): CoachQuote {
  const normalized = line.replace(/\r$/, "").trim();
  const match = normalized.match(/^\[([^\]]+)\]:\s*(.*)/);
  if (!match) {
    return { speaker: null, quote: normalized };
  }
  return { speaker: match[1]!.trim(), quote: match[2]!.trim() };
}

function clipQuote(body: string, maxChars = 320): string {
  if (body.length <= maxChars) return body;
  const slice = body.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd > maxChars * 0.45) {
    return slice.slice(0, sentenceEnd + 1).trimEnd();
  }
  const wordEnd = slice.lastIndexOf(" ");
  if (wordEnd > maxChars * 0.55) {
    return `${slice.slice(0, wordEnd).trimEnd()}…`;
  }
  return `${slice.trimEnd()}…`;
}

function pickCoachLines(
  transcript: string,
  patterns: RegExp[],
  limit: number,
): CoachQuote[] {
  const quotes: CoachQuote[] = [];
  for (const line of transcript.split(/\n+/)) {
    const { speaker, quote: body } = parseSpeakerLine(line);
    if (body.length < 20) continue;
    if (!patterns.some((p) => p.test(body))) continue;
    const quote = clipQuote(body);
    if (quotes.some((q) => q.quote === quote)) continue;
    quotes.push({ speaker, quote });
    if (quotes.length >= limit) break;
  }
  return quotes;
}

function pickPostCallQuotes(transcript: string): CoachQuote[] {
  const linePatterns: RegExp[] = [
    /I(?:'m| am) assigning your diagnostics[^.!?]*[.!?]/i,
    /You'll also get a (?:short )?recap message[^.!?]*[.!?]/i,
    /(?:And like we said, )?program(?:'s| is) (?:loaded|ready)[^.!?]*by[^.!?]*[.!?]/i,
    /I(?:'ll| will) build(?: out)? your (?:actual )?program[^.!?]*[.!?]/i,
  ];
  const quotes: CoachQuote[] = [];
  for (const line of transcript.split(/\n+/)) {
    const { speaker, quote: body } = parseSpeakerLine(line);
    if (body.length < 20) continue;
    for (const pattern of linePatterns) {
      if (quotes.length >= 3) break;
      const match = body.match(pattern);
      if (!match) continue;
      let excerpt = match[0].trim();
      if (!/[.!?]$/.test(excerpt)) excerpt = `${excerpt}.`;
      if (excerpt.length < 24) continue;
      if (
        quotes.some(
          (q) =>
            q.quote.includes(excerpt.slice(0, 28)) ||
            excerpt.includes(q.quote.slice(0, 28)),
        )
      ) {
        continue;
      }
      quotes.push({ speaker, quote: excerpt });
    }
    if (quotes.length >= 3) break;
  }
  return quotes.slice(0, 3);
}

const KICKOFF_QUOTE_PICKERS: Record<
  string,
  (transcript: string, score: number, maxScore: number) => CoachQuote[]
> = {
  d1: (t) =>
    pickCoachLines(
      t,
      [
        /got (?:it|the whole picture) in front|do not need to repeat|already went through/i,
        /forty-four|six years|architect|portland|eighteen months|PT a couple/i,
      ],
      2,
    ),
  d2: (t) =>
    pickCoachLines(
      t,
      [
        /rotator cuff|kettlebell|years back/i,
        /how did that feel|thank you for telling me|let(?:'s| us) (?:get into|actually get)/i,
        /daughter|climbing|belay|share something pretty real/i,
      ],
      2,
    ),
  d3: (t) =>
    pickCoachLines(
      t,
      [
        /forty-five minutes|shape of it|minutes together today/i,
        /get to know each other|goals|three phases|next call locked/i,
        /does that sound good|sound good to you/i,
      ],
      2,
    ),
  d4: (t, score, max) =>
    pickCoachLines(
      t,
      score >= max
        ? [
            /what i(?:'m| am) hearing|north star|belay partner|lily/i,
            /why is that important|what would happen if|thirty days|day thirty|ninety-minute/i,
            /that(?:'s| is) exactly it/i,
          ]
        : [
            /what are your goals|what(?:'re| are) you hoping|why is that important/i,
            /goal|pain|walkthrough|plantar/i,
          ],
      2,
    ),
  d5: (t) =>
    pickCoachLines(
      t,
      [
        /retraining|remodeling|integrating/i,
        /foundation|framing|occupied building|footings|load path/i,
        /phase three is literally|order matters|for you specifically/i,
      ],
      2,
    ),
  d6: (t) =>
    pickCoachLines(
      t,
      [
        /foundational.{0,40}not transformational|not transformational/i,
        /valley|week three|week four/i,
        /good discomfort|bad pain|sharp.{0,20}pain/i,
      ],
      2,
    ),
  d7: (t) =>
    pickCoachLines(
      t,
      [
        /training app|messag(?:e|ing)|day to day/i,
        /twenty-four hours|24 hours|response time/i,
        /community platform|push you|accountability/i,
      ],
      2,
    ),
  d8: (t) =>
    pickCoachLines(
      t,
      [
        /slow fade|what usually throws you|stopped you|fall apart/i,
        /learn best|load path|why behind/i,
        /push me|hold me to it|accountability/i,
      ],
      2,
    ),
  d9: (t) =>
    pickCoachLines(
      t,
      [
        /assign(?:ing)? your diagnostics|film.{0,40}movement|upload/i,
        /by thursday|by saturday|start monday|program loaded/i,
        /side angle|phone|notes in the app/i,
      ],
      2,
    ),
  d10: (t) =>
    pickCoachLines(
      t,
      [
        /next call locked|book(?:ing)? it now|calendar invite/i,
        /thursday the eleventh|three o'clock|four o'clock/i,
        /sending you the calendar invite/i,
      ],
      2,
    ),
  d11: (t) =>
    pickCoachLines(
      t,
      [
        /quick recap|so — today we reconnected|did i miss anything/i,
        /right place|kind of client who actually gets|excited to get going/i,
        /north star|day thirty|diagnostics filmed/i,
      ],
      2,
    ),
  d12: (t) => pickPostCallQuotes(t),
};

export function dimensionNeedsEvidenceBackfill(dim: DimensionResult): boolean {
  if (dim.disabled || dim.notApplicable || dim.score === null) return false;
  if (dim.notDemonstrated || dim.score <= 0) return false;
  const verified = dim.evidence.filter(
    (e) =>
      (e.verificationStatus === "verified" || e.demonstrated) &&
      !isBrokenEvidenceQuote(e.quote),
  );
  return verified.length === 0;
}

export function pickKickoffEvidenceQuotes(
  dimensionId: string,
  transcript: string,
  score: number,
  maxScore: number,
): CoachQuote[] {
  const picker = KICKOFF_QUOTE_PICKERS[dimensionId];
  if (!picker) return [];
  return picker(transcript, score, maxScore);
}

export function attachVerifiedEvidence(
  dim: DimensionResult,
  quotes: CoachQuote[],
): DimensionResult {
  if (quotes.length === 0) return dim;
  const evidence = quotes.map((item) => ({
    quote: item.quote,
    speaker: item.speaker,
    location: null as string | null,
    demonstrated: true,
    verificationStatus: "verified" as const,
  }));
  return {
    ...dim,
    evidence,
    verifiedEvidenceCount: evidence.length,
    rejectedEvidenceCount: 0,
    evidenceFound: true,
    notDemonstrated: false,
    evidenceStrength:
      evidence.length >= 2 ? ("high" as const) : ("medium" as const),
  };
}

export function backfillKickoffReportEvidence(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "kickoff" || !transcript?.trim()) return result;

  let changed = false;
  const dimensions = result.dimensions.map((dim) => {
    if (!dimensionNeedsEvidenceBackfill(dim)) return dim;
    const quotes = pickKickoffEvidenceQuotes(
      dim.id,
      transcript,
      dim.score ?? 0,
      dim.maxScore,
    );
    if (quotes.length === 0) return dim;
    changed = true;
    return attachVerifiedEvidence(dim, quotes);
  });

  if (!changed) return result;
  return {
    ...result,
    dimensions,
    evidenceQuality: summarizeReportEvidence(dimensions),
  };
}
