/**
 * Kick-off transcript calibrations (system-level, not call-specific).
 *
 * D11: no structured recap → max 3. Elite 5 needs recap + confidence + emotion.
 * D12: in-call coach deliverables with timing cannot score Fail 0.
 * D7: channel + response time + community present → Support Clarity may keep Elite.
 */

import type { EvaluationResult } from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";

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
    /i(?:'ll| will) (?:build|send|look at|review|put together|write|drop|have).{0,80}(?:program|feedback|plan|note|it ready)/i.test(
      transcript,
    );
  const timing =
    /(?:over the |by |this |ready )?(?:weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow|end of (?:the )?week)|gives me the weekend/i.test(
      transcript,
    );
  return coachCommit && timing;
}

/** Discrete-ish D12 floor when a timed coach commitment is present. */
export function kickoffPostCallFloor(transcript: string): number {
  if (!kickoffHasPostCallCommitment(transcript)) return 0;
  const richer =
    (/weekend/i.test(transcript) &&
      /(?:monday|notification|message me|live)/i.test(transcript)) ||
    (/i(?:'ll| will) (?:build|send|look at|review)/i.test(transcript) &&
      /i(?:'ll| will) (?:send|drop|message|check)/i.test(transcript));
  return richer ? 3.5 : 2.5;
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

function pickPostCallQuotes(transcript: string): string[] {
  const patterns = [
    /i(?:'ll| will) (?:build|send|look at|review).{0,80}(?:program|feedback)/i,
    /weekend|monday|friday/i,
  ];
  return pickMatchingLines(transcript, patterns, 2);
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

function withVerifiedQuotes<
  T extends {
    evidence: Array<{
      quote: string;
      speaker: string | null;
      location: string | null;
      demonstrated: boolean;
      verificationStatus?: "verified" | "unverified" | "rejected";
    }>;
    verifiedEvidenceCount?: number;
    rejectedEvidenceCount?: number;
    evidenceFound?: boolean;
    notDemonstrated?: boolean;
  },
>(dim: T, quotes: string[]): T {
  if (quotes.length === 0) return dim;
  const evidence = quotes.map((quote) => ({
    quote,
    speaker: null,
    location: null,
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
        patched = withVerifiedQuotes(patched, pickPostCallQuotes(transcript));
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
    if (floor > 0 && d12.score < floor) {
      next = recalculateAfterDimPatch(
        next,
        "d12",
        floor,
        "Commit to specific post-call deliverables with precise deadlines.",
        transcript,
      );
    }
  }

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
