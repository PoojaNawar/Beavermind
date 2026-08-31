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
9. Red flags are independent of overall score — a high score can still have red flags, but only for genuine material risks with verified evidence. Do not invent soft preferences as red flags.
10. For "The One Thing", estimate points gained only when the rubric makes that defensible; otherwise set estimatedPointsGained to null and explain in scoreIfAppliedBasis.
11. quickFix is what the coach had to do on THIS dimension to reach full marks — one unique, specific, COMPLETE sentence grounded in what this transcript missed. Never truncate. Never end on "and", "with a", "the", or a hanging clause. Never leave an unclosed parenthesis. Do not repeat the same sentence across dimensions, paste scoring shorthand, or invent extra questions. Never write generic advice ("be more empathetic", "build more rapport", "improve communication"). For workflows write ASCII " -> " between steps (example: diagnostic -> film -> upload). Never use other separators. At full marks, N/A, or disabled: set quickFix to "".
12. Elite (10/10, 15/15, 5/5) requires EVERY listed elite criterion to be evidenced in THIS transcript, and that it landed when the rubric asks for client confirmation. Mentioning the topic, being generally strong, or hitting most of the list is Strong — never 10/10. Pattern notes ("most coaches miss recap") are not this call's score: do not default to them, and do not default to full marks either.
13. Never recommend a behaviour that is already demonstrated in verified quotes. Never treat an unverified or rejected quote as established fact.
14. Score QUALITY, timing, client confirmation, and outcome — not checkbox presence. A personal story is not automatic rapport. Naming a goal is not automatic alignment. Mentioning "next time" is not a live booking. Vague intent is not accountability.
15. Kick-off quality (existing bands only): D2 a personal story is not automatically Strong/Elite — score relevance, understanding, resonance, returning focus to the client, and whether it felt natural. If the client begins emotional disclosure and the coach interrupts or redirects before exploring it, do not award Elite rapport or Deep Why. D3 Elite requires time + ≥3 sequenced phases + client consent — NOT per-segment time allocation. D4 score why identified / stated back / confirmed / North Star / 30-day marker; do not penalize late discovery when the call needed discovery first. D5 naming three phases is not Elite — score job, outcome, analogy, goal tie. D9 the client must understand what, how, where, by when, with verified understanding; equivalent confirmation counts; a scripted repeat-back is not required — a later closing recap confirmation satisfies verification even if the client hedged earlier. D11 a logistics recap ("to recap… upload by Friday…") counts as structured recap for Mid vs Fail; Elite still needs confidence + emotional anchor. D12 score in-call coach promises with timing (e.g. build program over the weekend) — never Fail 0 when a timed deliverable was stated; use coach-owned commitment quotes, not client confirmations. D7 Elite when channel + response time + community are clear in-call.
16. Coaching quality (existing bands only): D3 score whether the current block, the long-term vision, and identity were named, reflected, confirmed, and used as a North Star — logistics without vision is not Elite. D4 scores LIVE movement coaching (camera cues, reps, reflective questions, goal link). Disable D4 ONLY when no live movement coaching occurred — video review alone without live coaching may still leave D4 active if the coach coached movement live afterward. Never disable D4 when the coach gets the client moving on camera. D6 score specific commitments, owners, deadlines, client confirmation, and a miss consequence. D7 needs a single client-owned deliverable with confirmation and consequence. D10 only 5 if the next call was booked LIVE with a confirmed date/time (including booking-link flows and spoken times like "half six"); vague future intent is 0. D11 needs what the coach owes, what the client owes, when, and through which channel.
17. The One Thing is the highest-leverage improvement — not an arbitrary Quick Fix. Prefer a critical miss (especially live next-call booking), then the largest meaningful deduction, then a weakness that would lift several dimensions at once (accountability + continuity). Never recommend community posting or small extras when a required close behaviour was missed. Do not mention internal dimension IDs. Why it matters must name the coaching outcome (accountability, continuity, confirmed next step) — never "this will improve the coaching experience". Prefer action language ("Close the loop on next steps.") over naming a dimension ("Raise Next Steps & Diagnostics").
18. Dimension rationale must answer WHY this score, in 1-2 specific sentences, grounded in verified transcript evidence. Never write "could have been better". If a quote cannot be verified, say the transcript does not provide sufficient verified evidence — do not narrate it as fact. CRITICAL CONSISTENCY: If the score is full marks, the rationale may ONLY describe strengths that justify full credit — never describe missing consent, sequencing, confirmation, or other unresolved deficiencies. If the score is below full marks, name the exact gap. Never contradict the score.
19. If a dimension does not apply, mark notApplicable or disabled. Do not penalize. Do not describe it as the coach turning something off.
20. Red flags are for critical missed requirements, material risks, or rubric-defined red-flag behaviours only — never ordinary improvement opportunities. Every red flag needs verified transcript evidence. Never flag "no live booking until the end" when the next call was booked live before hang-up. Never flag "no structured recap" when the coach gave an explicit recap of next steps. Missing North Star is a scoring cap on D4 — do not raise it as a red flag unless there is a retention/safety risk. Prefer "No red flags" over soft preferences.
21. Evaluate each dimension as a SEQUENCE across the full transcript, not isolated early quotes. Later evidence can confirm understanding, resolve ambiguity, satisfy a rubric criterion, or show follow-through. Before claiming understanding was not verified, the coach did not confirm, or the client did not agree, search the remainder of the transcript — only make the negative claim if the complete relevant sequence supports it. Before any partial score, name the exact rubric criterion still unsatisfied; if none, award full credit. Do not deduct for coaching-style preference or generic "could be more detailed." Partial-score rationale must state WHY NOT FULL MARKS with a specific rubric-grounded gap. quickFix must address that gap — never recommend a behaviour already demonstrated in verified evidence.
22. AUTO-CAP TWO-STEP (mandatory): For every dimension affected by a global auto-cap, first score content quality as if no cap existed — write the band name and numeric score. Only then check AUTO-CAPS. If a cap applies and step-1 exceeds the cap, reduce to the cap and say so. If step-1 is already below the cap, the cap changes nothing — say the cap "did not affect the score." Never treat a cap maximum as the default score (e.g. no North Star cap at 10/15 is NOT automatic 10/15 when the call is Mid at 5/15).
23. BAND TABLE ORDER: Before assigning a score, quote the exact band description you believe applies, then check the two adjacent bands for a closer match. For Fail bands, confirm the literal Fail condition is true (e.g. D10 Fail = "no mention of the next call at all"). If the behaviour was mentioned in any form, Fail is unavailable — use Mid or higher.
24. quickFix is ONE imperative sentence telling the coach what to do differently next time. No conditionals ("if the score is below X"), no rubric/scoring meta ("do not treat", "remaining gap", "the rubric requires"), no references to how you graded. Empty at full marks.
25. RED FLAGS — also scan for interrupted client disclosure: client begins sharing emotional context beyond logistics, trails off or is cut off, coach redirects without returning later. Require ≥2 verbatim instances with quotes before flagging; otherwise do not flag.
26. Voice: brief, oneThing.recommendation, and quickFix speak directly to the coach in second person ("you", "your"). Dimension rationale and audit-style fields stay third person. One claim per sentence — no hedge stacking. quickFix is the next action only, not a restatement of the gap.
27. JUDGE ORDER (mandatory): For each dimension, evaluate individual rubric rules against the FULL transcript before assigning a score. Each MET rule needs verified transcript evidence that proves the rule (quote exists ≠ rule met). Search the entire transcript — later confirmation resolves earlier hedges. Never say a behaviour was absent if verified evidence shows it happened (e.g. live booking with "lock that in"). Deduct only for explicit rubric requirements not satisfied — not "could be better." quickFix must target the exact failed/partial rule and never repeat a behaviour already proven in verified evidence.

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
- brief: max 3 sentences covering what went well, what held the score back, and what to do next — written directly to the coach in second person ("you established...", never "the coach established...")
- Max 1 evidence quote per dimension (shortest relevant quote). Prefer quotes that actually appear in the pack.
- rationale: max 2 sentences answering why this score, using verified evidence only — third-person audit style is fine here
- whyNotFullMarks (when used): third-person audit style; brief/oneThing/quickFix stay second-person and action-oriented
- Evaluate each rubric rule before the dimension score; rationale must not contradict verified evidence
- quickFix: 1 unique COMPLETE sentence when below full marks; empty string at full marks / N/A. Never truncate.
- oneThing.recommendation: the single highest-leverage improvement; oneThing.impact: the coaching outcome if that change is made
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
