/**
 * Kick-off D11 (Close, Recap & Confidence) is transcript-grounded.
 *
 * Rubric: no structured recap → max 3. Elite 5 requires recap + confidence
 * anchor + emotional reinforcement. Never infer "missing recap" from model
 * rationale text alone — that mis-scored calls that already recapped.
 */

import type { EvaluationResult } from "@/lib/rubrics/types";
import { FULL_MARKS_QUICK_FIX } from "@/lib/scoring/quickFix";

export function kickoffHasStructuredRecap(transcript: string): boolean {
  const text = transcript.trim();
  if (!text) return false;
  const recapCue =
    /let'?s do a quick recap|quick recap before we|here'?s what we covered|so — today we reconnected|so - today we reconnected/i.test(
      text,
    );
  const substance =
    /north star|day thirty|day-thirty|day 30|what we covered today/i.test(text);
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

/** Correct a stored kick-off result when D11 was capped from rationale text. */
export function applyKickoffCloseCalibration(
  result: EvaluationResult,
  transcript: string | null | undefined,
): EvaluationResult {
  if (result.callType !== "kickoff" || !transcript?.trim()) return result;
  const d11 = result.dimensions.find((d) => d.id === "d11");
  if (!d11 || d11.disabled || d11.notApplicable || d11.score === null) {
    return result;
  }

  let next = d11.score;
  if (kickoffHasEliteClose(transcript)) {
    next = 5;
  } else if (!kickoffHasStructuredRecap(transcript) && d11.score > 3) {
    next = 3;
  }
  if (next === d11.score) return result;

  const delta = next - d11.score;
  const totalCap = result.firedCaps
    .map((c) => c.effect.match(/Total capped at (\d+)/i)?.[1])
    .find((n) => n !== undefined);
  const uncapped = result.overallScore + delta;
  const overallScore = totalCap
    ? Math.min(uncapped, Number(totalCap))
    : uncapped;

  const grade =
    overallScore >= 90
      ? "Elite"
      : overallScore >= 80
        ? "Strong"
        : overallScore >= 70
          ? "Inconsistent"
          : overallScore >= 60
            ? "At risk"
            : "Fail";

  return {
    ...result,
    overallScore,
    grade,
    dimensions: result.dimensions.map((d) =>
      d.id !== "d11"
        ? d
        : {
            ...d,
            score: next,
            quickFix: next >= d.maxScore ? FULL_MARKS_QUICK_FIX : d.quickFix,
          },
    ),
  };
}
