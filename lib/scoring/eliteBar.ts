/**
 * Transcript-grounded elite bar.
 *
 * Rubric: Elite requires every listed elite criterion, not "the topic came up."
 * These checks only cap inflated scores down — they never raise a score.
 * They do not hard-code a total or a prior judge finding.
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

export function kickoffHasNextStepsHowTo(transcript: string): boolean {
  return /(?:side )?angle|phone|device|how (?:do i|to) film|notes in the app|screen\s*share|demo(?:nstrat)?/i.test(
    transcript,
  );
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

export function kickoffHasNextStepsConfirmation(transcript: string): boolean {
  return /got it|that works|that(?:'s| is) clear|i think i can|thursday.{0,60}filming|program by|sounds good.{0,40}(?:thursday|monday|film)/i.test(
    transcript,
  );
}

export function kickoffHasNextStepsElite(transcript: string): boolean {
  return (
    kickoffHasNextStepsPipeline(transcript) &&
    kickoffHasNextStepsTimeline(transcript) &&
    kickoffHasNextStepsHowTo(transcript) &&
    kickoffHasNextStepsConfirmation(transcript)
  );
}

export function kickoffHasProgramElite(transcript: string): boolean {
  const phases =
    /retraining/i.test(transcript) &&
    /remodeling/i.test(transcript) &&
    /integrating/i.test(transcript);
  const jobOrOutcome =
    /foundation|framing|occupied|for you specifically|phase (?:one|two|three).{0,80}(?:means|that(?:'s| is))/i.test(
      transcript,
    );
  const goalTie =
    /belay|your (?:goal|north star)|for you.{0,40}(?:that is|that(?:'s| is))|maps onto your/i.test(
      transcript,
    );
  return phases && jobOrOutcome && goalTie;
}

export function kickoffHasRapportElite(transcript: string): boolean {
  const personalShare =
    /i (?:did|had|was).{0,120}(?:shoulder|back|injury|myself)|rotator cuff|years back/i.test(
      transcript,
    );
  const connected =
    /for you|your (?:shoulder|back|situation)|when i see .{0,40}in someone|personal stake/i.test(
      transcript,
    );
  const returnedFocus =
    /let(?:'s| us) (?:get into|talk about|actually get)|enough about me|your goals/i.test(
      transcript,
    );
  return personalShare && connected && returnedFocus;
}

export function kickoffHasDeepWhyElite(transcript: string): boolean {
  const statedBack =
    /what i(?:'m| am) hearing|north star|the dad who|what you actually want/i.test(
      transcript,
    );
  const confirmed =
    /that(?:'s| is) exactly|it does(?: land)?|yeah.{0,24}that(?:'s| is) exactly/i.test(
      transcript,
    );
  const day30 =
    /thirty days|day[- ]thirty|day 30|ninety-minute|90-minute|day-thirty/i.test(
      transcript,
    );
  return statedBack && confirmed && day30;
}

export function coachingHasCheckInElite(transcript: string): boolean {
  const body =
    /body.{0,40}feel|how(?:'s| is) (?:your body|the (?:knee|shoulder|back|hip))|feeling today|right now, not the/i.test(
      transcript,
    );
  const winOrStruggle =
    /biggest win|genuine win|what felt hard|felt hardest|struggl|what(?:'s| is) been (?:hard|tough)/i.test(
      transcript,
    );
  const reflectOrIntention =
    /what i(?:'m| am) hearing|let(?:'s| us) use this call|what i want to do with today|intention for (?:this|today)|kind of call|here(?:'s| is) how i want to start/i.test(
      transcript,
    );
  return body && winOrStruggle && reflectOrIntention;
}

/**
 * If the model awarded Elite on a discrete dimension but the transcript is
 * missing a required elite item, snap to Strong. Never raises a score.
 */
export function nextEliteScore(
  callType: CallType,
  dimensionId: string,
  score: number | null,
  transcript: string | undefined,
): number | null {
  if (score === null || !transcript?.trim()) return score;

  if (callType === "kickoff") {
    if (dimensionId === "d2" && score >= 10 && !kickoffHasRapportElite(transcript)) {
      return 7;
    }
    if (dimensionId === "d4" && score >= 15 && !kickoffHasDeepWhyElite(transcript)) {
      return 10;
    }
    if (dimensionId === "d5" && score >= 9 && !kickoffHasProgramElite(transcript)) {
      return 8;
    }
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
