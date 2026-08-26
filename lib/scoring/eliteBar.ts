/**
 * Transcript-grounded elite bar.
 *
 * Rubric: Elite (including 10/10) requires every listed elite criterion, not
 * "the topic came up." Missing any elite item belongs in Strong. These checks
 * only cap inflated scores down — they never raise a score.
 */

import type { CallType } from "@/lib/rubrics/types";

export function kickoffHasJourneyElite(transcript: string): boolean {
  const valley = /week three|week 3|week four|week 4|\bvalley\b/i.test(transcript);
  const foundational =
    /foundational.{0,80}not transformational|not transformational/i.test(
      transcript,
    );
  const pain =
    /good discomfort|bad pain|sharp.{0,40}pain|good pain versus bad/i.test(
      transcript,
    );
  return valley && foundational && pain;
}

export function kickoffHasCoachingIntelElite(transcript: string): boolean {
  const behavioral =
    /throw(s)? you off|stopped you|fall apart|slow fade|what usually (throws|makes you quit)/i.test(
      transcript,
    );
  const selfAwareness =
    /learn best|push(ing)? you|why behind|do you want me pushing/i.test(
      transcript,
    );
  return behavioral && selfAwareness;
}

export function kickoffHasNextStepsDemo(transcript: string): boolean {
  return /screen\s*share|i(?:'m| am) (?:sharing|showing) (?:my )?(?:screen|the app)|walk you through .{0,40}(?:app|film)|demo(?:nstrat)?/i.test(
    transcript,
  );
}

export function kickoffHasNextStepsPipeline(transcript: string): boolean {
  return (
    /diagnostic/i.test(transcript) &&
    /film/i.test(transcript) &&
    /(?:upload|program)/i.test(transcript)
  );
}

export function kickoffHasNextStepsTimeline(transcript: string): boolean {
  return /by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\b(?:monday|saturday|thursday)\b.{0,40}(?:program|film|start)/i.test(
    transcript,
  );
}

export function kickoffHasNextStepsElite(transcript: string): boolean {
  return (
    kickoffHasNextStepsPipeline(transcript) &&
    kickoffHasNextStepsTimeline(transcript) &&
    kickoffHasNextStepsDemo(transcript)
  );
}

export function coachingHasCheckInElite(transcript: string): boolean {
  const body = /body.{0,40}feel|how(?:'s| is) your body|pain.{0,20}(?:today|this week)/i.test(
    transcript,
  );
  const winOrStruggle =
    /biggest win|what felt hard|struggl|what(?:'s| is) been (?:hard|tough)/i.test(
      transcript,
    );
  const reflectOrIntention =
    /what i(?:'m| am) hearing|let(?:'s| us) use this call|intention for (?:this|today)|kind of call/i.test(
      transcript,
    );
  return body && winOrStruggle && reflectOrIntention;
}

/**
 * If the model awarded Elite/max on a discrete 10-pt dimension but the
 * transcript is missing a required elite item, snap to Strong (7).
 */
export function nextEliteScore(
  callType: CallType,
  dimensionId: string,
  score: number | null,
  transcript: string | undefined,
): number | null {
  if (score === null || !transcript?.trim()) return score;

  if (callType === "kickoff") {
    if (dimensionId === "d6" && score >= 10 && !kickoffHasJourneyElite(transcript)) {
      return 7;
    }
    if (
      dimensionId === "d8" &&
      score >= 10 &&
      !kickoffHasCoachingIntelElite(transcript)
    ) {
      return 7;
    }
    if (dimensionId === "d9" && score >= 10 && !kickoffHasNextStepsElite(transcript)) {
      return 7;
    }
  }

  if (
    callType === "coaching" &&
    dimensionId === "d1" &&
    score >= 10 &&
    !coachingHasCheckInElite(transcript)
  ) {
    return 7;
  }

  return score;
}
