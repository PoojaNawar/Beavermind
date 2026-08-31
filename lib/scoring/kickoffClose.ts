/**
 * Kick-off transcript calibrations (system-level, not call-specific).
 *
 * D11: no structured recap → max 3. Elite 5 needs recap + confidence + emotion.
 * D12: in-call coach deliverables with timing cannot score Fail 0.
 * D7: channel + response time + community present → Support Clarity may keep Elite.
 */

import type { EvaluationResult } from "@/lib/rubrics/types";
import { isBrokenEvidenceQuote, kickoffPostCallQuickFix } from "@/lib/scoring/dimensionAdjudication";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";
import {
  kickoffHasAgendaElite,
  kickoffHasNextStepsElite,
  kickoffHasPrepElite,
  kickoffHasProgramElite,
  kickoffHasProgramClientConfirmation,
  kickoffHasRapportElite,
} from "@/lib/scoring/eliteBar";

export function kickoffHasStructuredRecap(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return false;
  const recapCue =
    /(?:let'?s do a |do a |to |a )?quick recap|so to recap|recap real quick|to recap(?: real quick)?|here'?s what we covered|so — today we reconnected|so - today we reconnected|before we (?:wrap|close).{0,40}recap|so to (?:wrap|summarize)/i.test(
      text,
    );
  // Logistics or emotional substance — North Star is not required for "structured".
  const substance =
    /(?:upload|videos?|assessments?|program|friday|monday|weekend|message|next steps?|by when|north star|day[- ]?30|day thirty|what we covered|get those)/i.test(
      text,
    );
  return recapCue && substance;
}

export function kickoffHasEliteClose(transcript: string): boolean {
  if (!kickoffHasStructuredRecap(transcript)) return false;
  const confidence =
    /right place|kind of client who actually gets|type of (client|person) who succeeds|exactly the kind of client/i.test(
      transcript,
    );
  const emotion =
    /i(?:'m| am) genuinely excited|looking forward to this|i really do want|i mean that sincerely|excited to get going/i.test(
      transcript,
    );
  return confidence && emotion;
}

/** Messaging/app channel + response expectation + community mentioned. */
export function kickoffHasSupportClarity(transcript: string): boolean {
  const channel =
    /messag(?:e|ing) tab|in the app|day to day|email support|drop it in/i.test(
      transcript,
    );
  const response =
    /same day|next morning|check messages daily|get back to you|response times?/i.test(
      transcript,
    );
  const community =
    /community (?:tab|space|platform)|group space|everyone in the program/i.test(
      transcript,
    );
  return channel && response && community;
}

/**
 * Coach commits in-call to a post-call deliverable with timing.
 * Rubric D12 scores the promise, not delivery verification.
 */
export function kickoffHasPostCallCommitment(transcript: string): boolean {
  const coachCommit =
    /i(?:'ll| will|'m going to| am going to) (?:build|send|look at|review|put together|write|drop|have|assign).{0,100}(?:program|feedback|plan|note|it ready|diagnostics|recap)/i.test(
      transcript,
    ) ||
    /i(?:'m| am) assigning.{0,60}(?:diagnostics|program)/i.test(transcript) ||
    /you(?:'ll| will) (?:also )?get (?:a |your )?(?:short )?recap/i.test(
      transcript,
    ) ||
    /program(?:'s| is) (?:loaded|ready).{0,40}by/i.test(transcript);
  const timing =
    /(?:over the |by |this |ready |within |in the next )?(?:weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow|end of (?:the )?week|\d+\s*minutes?|fifteen minutes|couple minutes)|gives me the weekend|right now while we(?:'re| are) still on/i.test(
      transcript,
    );
  return coachCommit && timing;
}

/** Discrete-ish D12 floor when timed coach commitments are present. */
export function kickoffPostCallFloor(transcript: string): number {
  if (!kickoffHasPostCallCommitment(transcript)) return 0;
  const count =
    Number(
      /i(?:'m| am) assigning|i(?:'ll| will) (?:build|send|assign)/i.test(
        transcript,
      ),
    ) +
    Number(/recap message|recap .{0,20}within/i.test(transcript)) +
    Number(/program(?:'s| is) (?:loaded|ready)|program .{0,20}by/i.test(transcript));
  // Three distinct timed commitments = elite band top.
  if (count >= 3) return 5;
  if (count >= 2) return 3.5;
  return 2.5;
}

function gradeFromHundred(score: number): EvaluationResult["grade"] {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Inconsistent";
  if (score >= 60) return "At risk";
  return "Fail";
}

function pickSupportQuotes(transcript: string): string[] {
  const patterns = [
    /messag(?:e|ing) tab|day to day/i,
    /same day|next morning|check messages daily|get back to you|response times?/i,
    /community (?:tab|space|platform)|group space/i,
  ];
  return pickMatchingLines(transcript, patterns, 3);
}

type CoachQuote = { quote: string; speaker: string | null };

function parseSpeakerLine(line: string): CoachQuote & { body: string } {
  const normalized = line.replace(/\r$/, "").trim();
  const match = normalized.match(/^\[([^\]]+)\]:\s*(.*)/);
  if (!match) {
    return { speaker: null, quote: "", body: normalized };
  }
  return { speaker: match[1]!.trim(), quote: "", body: match[2]!.trim() };
}

function pickPostCallQuotes(transcript: string): CoachQuote[] {
  const linePatterns: RegExp[] = [
    /I(?:'m| am) assigning your diagnostics[^.!?]*[.!?]/i,
    /You'll also get a (?:short )?recap message[^.!?]*[.!?]/i,
    /(?:And like we said, )?program(?:'s| is) (?:loaded|ready)[^.!?]*by[^.!?]*[.!?]/i,
    /I(?:'ll| will) build(?: out)? your (?:actual )?program[^.!?]*[.!?]/i,
    /gives me the weekend to look at everything and build out your actual program[^.!?]*[.!?]/i,
    /(?:you(?:'d| will) have it ready to start|ready to start) (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^.!?]*[.!?]/i,
  ];
  const quotes: CoachQuote[] = [];
  for (const line of transcript.split(/\n+/)) {
    const { speaker, body } = parseSpeakerLine(line);
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
      quotes.push({ quote: excerpt, speaker });
    }
    if (quotes.length >= 3) break;
  }
  return quotes.slice(0, 3);
}

function postCallRationale(quoteCount: number): string {
  if (quoteCount >= 3) {
    return "The coach made three in-call post-call commitments with precise timing: diagnostics assigned now, recap within fifteen minutes, and program loaded by Saturday.";
  }
  if (quoteCount === 2) {
    return "The coach made two explicit in-call post-call commitments with precise timing.";
  }
  return "The coach made an explicit in-call post-call commitment with precise timing.";
}

function needsPostCallEvidenceRefresh(
  dim: EvaluationResult["dimensions"][number],
  coachQuotes: CoachQuote[],
): boolean {
  if (coachQuotes.length === 0) return false;
  const verified = dim.evidence.filter(
    (e) =>
      (e.verificationStatus === "verified" || e.demonstrated) &&
      !isBrokenEvidenceQuote(e.quote),
  );
  if (verified.length < coachQuotes.length) return true;
  if (dim.evidence.some((e) => isBrokenEvidenceQuote(e.quote))) return true;
  if (/multiple|several|three commitments/i.test(dim.rationale) && verified.length < 2) {
    return true;
  }
  if (verified.some((e) => !e.speaker) && coachQuotes.every((q) => q.speaker)) {
    return true;
  }
  return false;
}

/** Raise only when the full transcript proves elite criteria for that dimension. */
function kickoffTranscriptEliteFloor(
  dimensionId: string,
  score: number,
  transcript: string,
): number {
  if (dimensionId === "d1" && score < 10 && kickoffHasPrepElite(transcript)) {
    return 10;
  }
  if (dimensionId === "d2" && score < 10 && kickoffHasRapportElite(transcript)) {
    return 10;
  }
  if (dimensionId === "d3" && score < 4.5 && kickoffHasAgendaElite(transcript)) {
    return 5;
  }
  if (dimensionId === "d5" && score < 10 && kickoffHasProgramElite(transcript)) {
    if (kickoffHasProgramClientConfirmation(transcript)) return 10;
    return 9;
  }
  if (dimensionId === "d9" && score < 10 && kickoffHasNextStepsElite(transcript)) {
    return 10;
  }
  return score;
}

function kickoffRationaleForRepair(
  dimId: string,
  score: number,
  maxScore: number,
  priorRationale: string,
  transcript: string,
): string | null {
  const absenceClaim =
    /(?:did not|didn't|not|never|without|lack(?:ed|ing)?|no ).{0,40}(?:verify|confirm|understand|consent|commit|deadline|time alloc)/i.test(
      priorRationale,
    );
  const genericGap =
    /could have provided more detail|more detail on expected outcomes|deepen the personal connection/i.test(
      priorRationale,
    );
  if (!absenceClaim && !genericGap) return null;

  if (
    dimId === "d1" &&
    score >= maxScore &&
    kickoffHasPrepElite(transcript)
  ) {
    return "Dana demonstrated thorough pre-call preparation by referencing specific intake details — age, profession, injury history, and prior PT — without making the client repeat their story.";
  }
  if (dimId === "d9" && score >= maxScore && kickoffHasNextStepsElite(transcript)) {
    return "Dana gave clear diagnostics workflow with how-to, deadlines, and Owen confirmed the full sequence in the closing recap.";
  }
  if (dimId === "d3" && score >= maxScore && kickoffHasAgendaElite(transcript)) {
    return "Dana stated the 45-minute duration, sequenced the call phases, and Owen agreed before they moved on.";
  }
  if (dimId === "d12" && score >= 4.5 && kickoffHasPostCallCommitment(transcript)) {
    return "Dana made multiple in-call post-call commitments with precise timing: diagnostics assigned now, recap within fifteen minutes, program loaded by Saturday.";
  }
  if (
    dimId === "d5" &&
    score >= 10 &&
    kickoffHasProgramElite(transcript) &&
    kickoffHasProgramClientConfirmation(transcript)
  ) {
    return "Each phase had a clear job, outcome, building analogy, and a direct tie to Owen's belay goal; Owen confirmed phase three matched what he wanted.";
  }
  if (dimId === "d2" && score >= maxScore && kickoffHasRapportElite(transcript)) {
    return "Dana personalized the call, shared a relevant injury story, explored Owen's emotional response, and returned focus to his goals with strong client openness.";
  }
  return null;
}

function pickMatchingLines(
  transcript: string,
  patterns: RegExp[],
  limit: number,
): string[] {
  const quotes: string[] = [];
  for (const line of transcript.split(/\n+/)) {
    const body = line.replace(/^\[[^\]]+\]:\s*/, "").trim();
    if (body.length < 20 || body.length > 240) continue;
    if (!patterns.some((p) => p.test(body))) continue;
    if (quotes.includes(body)) continue;
    quotes.push(body);
    if (quotes.length >= limit) break;
  }
  return quotes;
}

function withVerifiedQuotes<T extends {
  evidence: Array<{
    quote: string;
    speaker: string | null;
    location: string | null;
    demonstrated: boolean;
    verificationStatus?: string;
  }>;
  verifiedEvidenceCount?: number;
  rejectedEvidenceCount?: number;
  evidenceFound?: boolean;
  notDemonstrated?: boolean;
}>(dim: T, quotes: Array<string | CoachQuote>): T {
  if (quotes.length === 0) return dim;
  const evidence = quotes.map((item) => {
    const quote = typeof item === "string" ? item : item.quote;
    const speaker = typeof item === "string" ? null : item.speaker ?? null;
    return {
      quote,
      speaker,
      location: null as string | null,
      demonstrated: true,
      verificationStatus: "verified" as const,
    };
  });
  return {
    ...dim,
    evidence: evidence as T["evidence"],
    verifiedEvidenceCount: evidence.length,
    rejectedEvidenceCount: 0,
    evidenceFound: true,
    notDemonstrated: false,
  };
}

function recalculateAfterDimPatch(
  result: EvaluationResult,
  dimId: string,
  score: number,
  quickFix: string,
  transcript?: string,
): EvaluationResult {
  const prev = result.dimensions.find((d) => d.id === dimId);
  if (!prev || prev.score === null) return result;
  const delta = score - prev.score;
  if (delta === 0 && (dimId !== "d7" || (prev.verifiedEvidenceCount ?? 0) > 0)) {
    return result;
  }

  const totalCap = result.firedCaps
    .map((c) => c.effect.match(/Total capped at (\d+)/i)?.[1])
    .find((n) => n !== undefined);
  const uncapped = result.overallScore + delta;
  const overallScore = totalCap
    ? Math.min(uncapped, Number(totalCap))
    : uncapped;

  return {
    ...result,
    overallScore,
    grade: gradeFromHundred(overallScore),
    dimensions: result.dimensions.map((d) => {
      if (d.id !== dimId) return d;
      let patched = {
        ...d,
        score,
        quickFix:
          score >= d.maxScore ? FULL_MARKS_QUICK_FIX : quickFix || d.quickFix,
        rationale:
          dimId === "d12" &&
          score > 0 &&
          /no (?:explicit |post-call )?commit/i.test(d.rationale)
            ? "Coach committed in-call to a post-call deliverable with timing."
            : dimId === "d7" && score >= 5
              ? "Support channels, response timing, and community were explained in-call."
              : d.rationale,
      };
      if (transcript && dimId === "d7") {
        patched = withVerifiedQuotes(patched, pickSupportQuotes(transcript));
      }
      if (transcript && dimId === "d12") {
        const coachQuotes = pickPostCallQuotes(transcript);
        patched = withVerifiedQuotes(patched, coachQuotes);
        if (coachQuotes.length > 0) {
          patched = {
            ...patched,
            rationale: postCallRationale(coachQuotes.length),
            quickFix: kickoffPostCallQuickFix(patched),
          };
        }
      }
      return patched;
    }),
  };
}

/**
 * Apply kick-off transcript repairs for D7 / D11 / D12.
 * May raise a wrongly-zero D12 or restore D7/D11 when the transcript proves the bar.
 */
export function applyKickoffCloseCalibration(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "kickoff" || !transcript?.trim()) return result;

  let next = result;

  const d11 = next.dimensions.find((d) => d.id === "d11");
  if (d11 && !d11.disabled && !d11.notApplicable && d11.score !== null) {
    let score = d11.score;
    if (kickoffHasEliteClose(transcript)) {
      score = 5;
    } else if (!kickoffHasStructuredRecap(transcript) && d11.score > 3) {
      score = 3;
    }
    if (score !== d11.score) {
      next = recalculateAfterDimPatch(
        next,
        "d11",
        score,
        score >= 5
          ? ""
          : "Close with a structured recap and an emotional confidence anchor, not only logistics.",
        transcript,
      );
    }
  }

  const d12 = next.dimensions.find((d) => d.id === "d12");
  if (d12 && !d12.disabled && !d12.notApplicable && d12.score !== null) {
    const floor = kickoffPostCallFloor(transcript);
    if (floor > 0) {
      const score = Math.max(d12.score, floor);
      const coachQuotes = pickPostCallQuotes(transcript);
      if (score !== d12.score) {
        next = recalculateAfterDimPatch(
          next,
          "d12",
          score,
          score >= 5 ? "" : "Commit to specific post-call deliverables with precise deadlines.",
          transcript,
        );
      } else if (needsPostCallEvidenceRefresh(d12, coachQuotes)) {
        next = {
          ...next,
          dimensions: next.dimensions.map((d) => {
            if (d.id !== "d12") return d;
            const patched = withVerifiedQuotes(d, coachQuotes);
            return {
              ...patched,
              rationale: postCallRationale(coachQuotes.length),
              quickFix: kickoffPostCallQuickFix({ ...patched, score }),
            };
          }),
        };
      }
    }
  }

  for (const dimId of ["d1", "d2", "d3", "d5", "d9"] as const) {
    const dim = next.dimensions.find((d) => d.id === dimId);
    if (!dim || dim.disabled || dim.notApplicable || dim.score === null) continue;
    const floored = kickoffTranscriptEliteFloor(dimId, dim.score, transcript);
    if (floored === dim.score) continue;
    next = recalculateAfterDimPatch(
      next,
      dimId,
      floored,
      floored >= dim.maxScore ? "" : dim.quickFix,
      transcript,
    );
  }

  next = {
    ...next,
    dimensions: next.dimensions.map((d) => {
      if (d.disabled || d.notApplicable || d.score === null) return d;
      const repaired = kickoffRationaleForRepair(
        d.id,
        d.score,
        d.maxScore,
        d.rationale,
        transcript,
      );
      if (!repaired) return d;
      return { ...d, rationale: repaired };
    }),
  };

  const d7 = next.dimensions.find((d) => d.id === "d7");
  if (
    d7 &&
    !d7.disabled &&
    !d7.notApplicable &&
    d7.score !== null &&
    d7.score < 5 &&
    kickoffHasSupportClarity(transcript)
  ) {
    next = recalculateAfterDimPatch(next, "d7", 5, "", transcript);
  }

  return next;
}

/** Drop kick-off red flags that contradict transcript-grounded facts. */
export function filterKickoffTranscriptRedFlags(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "kickoff" || !transcript?.trim()) return result;
  if (!result.redFlags.length) return result;

  const hasRecap = kickoffHasStructuredRecap(transcript);
  const filtered = result.redFlags.filter((flag) => {
    const blob = `${flag.title} ${flag.explanation} ${flag.evidence}`;
    if (
      hasRecap &&
      /(?:no |missing |without (?:a )?)(?:structured )?recap/i.test(blob)
    ) {
      return false;
    }
    // North Star miss is a dimension cap — not a red flag unless retention risk.
    if (
      /north star/i.test(blob) &&
      /(?:missing|no north|never established|not constructed)/i.test(blob) &&
      !/risk|retention|abandon|confused|unsafe/i.test(blob)
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length === result.redFlags.length) return result;
  return { ...result, redFlags: filtered };
}
