import type { Rubric, RubricDimension } from "@/lib/rubrics/types";

export const SYSTEM_INSTRUCTIONS = `You are an expert call-quality evaluator for a coaching business (Halden Method).

You score coaching/kick-off calls ONLY against the supplied rubric.

CRITICAL ANTI-HALLUCINATION RULES:
1. Use ONLY the transcript as evidence. Never invent behaviour.
2. If a required behaviour is absent, say so explicitly ("not demonstrated in the transcript") and score accordingly.
3. Do NOT infer intent, mood, tone, or "they probably did X".
4. Do NOT fabricate quotations. Quotes must be verbatim or near-verbatim excerpts from the transcript.
5. Every positive or negative claim must be traceable to transcript evidence when the rubric requires it.
6. Keep evidence concise — 1–3 short excerpts per dimension, not walls of text.
7. Do NOT calculate the overall score or grade band — the backend does that from dimension scores.
8. Score only according to the rubric bands/buckets. For coaching calls, scores must be exact bucket values.
9. Red flags are independent of overall score — a high score can still have red flags.
10. For "The One Thing", estimate points gained only when the rubric makes that defensible; otherwise set estimatedPointsGained to null and explain in scoreIfAppliedBasis.
11. quickFix is what the coach had to do on THIS dimension to reach full marks — one unique, specific, actionable sentence grounded in what this transcript missed. Do not repeat the same sentence across dimensions, paste scoring shorthand, or invent extra questions. Never write generic advice ("be more empathetic", "build more rapport", "improve communication"). For workflows write ASCII " -> " between steps (example: diagnostic -> film -> upload). Never use other separators. At full marks, N/A, or disabled: set quickFix to "".
12. Elite (10/10, 15/15, 5/5) requires EVERY listed elite criterion to be evidenced in THIS transcript, and that it landed when the rubric asks for client confirmation. Mentioning the topic, being generally strong, or hitting most of the list is Strong — never 10/10. Pattern notes ("most coaches miss recap") are not this call's score: do not default to them, and do not default to full marks either.
13. Never recommend a behaviour that is already demonstrated in verified quotes.
14. Kick-off quality (existing bands only): D2 a personal story is not automatically Strong/Elite — score relevance, understanding, resonance, returning focus to the client, and whether it felt natural. D4 score why identified / stated back / confirmed / North Star / 30-day marker; do not penalize late discovery when the call needed discovery first. D5 naming three phases is not Elite — score job, outcome, analogy, goal tie. D9 the client must understand what, how, where, by when, with verified understanding; equivalent confirmation counts, a scripted repeat-back is not required.

OUTPUT:
Return structured JSON matching the schema. Include all 12 dimensions.
For evidence items that support a missing behaviour, set demonstrated=false and quote to a short note like "Not demonstrated in transcript".
`;

const EVIDENCE_EXTRACTION_INSTRUCTIONS = `MODE: Evidence extraction (chunk pass).
You are extracting evidence for later scoring. Do NOT assign final dimension scores.
For each rubric dimension, list relevant verbatim quotes from the chunk (or state none found in this chunk).
Never invent quotes. If behaviour is absent in this chunk, note that in observations — do not claim it happened.
`;

const SYNTHESIS_INSTRUCTIONS = `MODE: Final synthesis from aggregated evidence.
You are scoring all 12 dimensions using ONLY the aggregated evidence pack below.
The full transcript is NOT included in this prompt — use only quotes and observations from the evidence pack.
Do not invent evidence. If the pack shows a behaviour was not demonstrated, score accordingly.
When citing evidence in dimension results, reuse verbatim quotes from the evidence pack.

CONCISENESS (required for output limits):
- brief: max 3 sentences
- Max 1 evidence quote per dimension (shortest relevant quote)
- rationale: max 2 sentences per dimension
- quickFix: 1 unique sentence when below full marks; empty string at full marks / N/A
- redFlags: only if clearly supported by evidence; max 3 items
- notes: 1-2 sentences max
`;

function formatDimension(d: RubricDimension): string {
  const flags = [
    d.optional ? "optional/disableable" : null,
    d.mayBeNotApplicable ? "may be N/A" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const bandLines = d.bands
    .map((b) => {
      const range =
        b.min === b.max ? `${b.min}` : `${b.min}–${b.max}`;
      return `    ${b.name} (${range}): ${b.criteria}`;
    })
    .join("\n");

  const discrete =
    d.discreteScores && d.discreteScores.length > 0
      ? `\n  Allowed scores (exact): ${d.discreteScores.join(", ")}`
      : "";

  const positive =
    d.positiveSignals && d.positiveSignals.length > 0
      ? `\n  Positive signals: ${d.positiveSignals.join("; ")}`
      : "";

  const negative =
    d.negativeSignals && d.negativeSignals.length > 0
      ? `\n  Negative signals: ${d.negativeSignals.join("; ")}`
      : "";

  return `- ${d.id}: ${d.name} (max ${d.maxScore}${flags ? `, ${flags}` : ""})
  ${d.description}
  Scoring: ${d.scoringCriteria}${discrete}
  Bands:
${bandLines}${positive}${negative}`;
}

/**
 * Compact structured rubric for API prompts — derived from canonical typed rubric objects.
 * Does NOT embed the full markdown (avoids ~8–9K duplicate tokens per call).
 */
export function buildCompactRubricSection(rubric: Rubric): string {
  const caps = rubric.autoCaps
    .map((c) => {
      const parts = [`id=${c.id}`, c.condition];
      if (c.maxTotal !== undefined) parts.push(`maxTotal=${c.maxTotal}`);
      if (c.dimensionId) parts.push(`dimension=${c.dimensionId}`);
      if (c.maxDimensionScore !== undefined)
        parts.push(`maxDimScore=${c.maxDimensionScore}`);
      if (c.forceDimensionScore !== undefined)
        parts.push(`forceDimScore=${c.forceDimensionScore}`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const dimensions = rubric.dimensions.map(formatDimension).join("\n\n");

  return `RUBRIC: ${rubric.name} (${rubric.version})
Total points: ${rubric.totalPoints}
Grade bands: ${rubric.gradeBands.map((g) => `${g.band} ${g.min}–${g.max} (${g.description})`).join("; ")}

SCORING NOTES:
${rubric.scoringNotes.map((n) => `- ${n}`).join("\n")}

AUTO-CAPS (report firedCapIds when a condition applies):
${caps}

DIMENSIONS:
${dimensions}`;
}

/** Stable system prompt: instructions + compact rubric (cache-friendly across chunk calls). */
export function buildSystemPrompt(
  rubric: Rubric,
  mode: "evaluation" | "extraction" | "synthesis",
): string {
  const rubricSection = buildCompactRubricSection(rubric);
  const modeBlock =
    mode === "extraction"
      ? EVIDENCE_EXTRACTION_INSTRUCTIONS
      : mode === "synthesis"
        ? SYNTHESIS_INSTRUCTIONS
        : "";

  return `${SYSTEM_INSTRUCTIONS}

${rubricSection}
${modeBlock ? `\n${modeBlock}` : ""}`.trim();
}

/** @deprecated Use buildCompactRubricSection — kept for tests/docs references. */
export function buildRubricPromptSection(rubric: Rubric): string {
  return buildCompactRubricSection(rubric);
}

export function buildUserEvaluationPrompt(args: {
  transcript: string;
  mode: "single" | "synthesis";
  evidencePack?: string;
  dimensionIds?: string[];
  includeSummaryFields?: boolean;
}): string {
  const { transcript, mode, evidencePack, dimensionIds, includeSummaryFields } =
    args;

  if (mode === "synthesis") {
    const dimList = dimensionIds?.join(", ") ?? "all 12";
    const summaryNote = includeSummaryFields
      ? "\nAlso provide oneThing, brief, redFlags, firedCapIds, and notes."
      : "\nDo NOT include oneThing, brief, redFlags, firedCapIds, or notes — dimensions only.";

    return `Score rubric dimensions: ${dimList}.${summaryNote}
Use ONLY the aggregated evidence pack below. Do not invent evidence.

AGGREGATED EVIDENCE PACK:
${evidencePack ?? "(empty)"}`;
  }

  return `Evaluate the full transcript below against the rubric.

TRANSCRIPT:
${transcript}`;
}

export function buildEvidenceExtractionPrompt(args: {
  chunkText: string;
  chunkIndex: number;
  chunkCount: number;
}): string {
  return `Extract evidence from transcript chunk ${args.chunkIndex + 1} of ${args.chunkCount}.
List findings for each rubric dimension with verbatim quotes where present.

CHUNK:
${args.chunkText}`;
}
