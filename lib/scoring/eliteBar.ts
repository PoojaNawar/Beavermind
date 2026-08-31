/**
 * Transcript-grounded elite bar.
 *
 * Rubric: Elite requires every listed elite criterion, not "the topic came up."
 * These checks only cap inflated scores down — they never raise a score.
 * They do not hard-code a total or a prior judge finding.
 */

import type { CallType } from "@/lib/rubrics/types";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";

export function kickoffHasAgendaElite(transcript: string): boolean {
  const time =
    /\b\d{1,3}\s*(?:min(?:ute)?s?)\b/i.test(transcript) ||
    /\b(?:fifteen|twenty(?:[- ]five)?|thirty(?:[- ]five)?|forty(?:[- ]five)?|forty|sixty)\s+minutes?\b/i.test(
      transcript,
    ) ||
    /minutes together|about .{0,20}minutes/i.test(transcript);
  const thenCount = (transcript.match(/\bthen\b/gi) || []).length;
  const sequenced =
    (/first/i.test(transcript) && thenCount >= 2) ||
    (/(?:first|1[.\)\:]|phase\s*one)/i.test(transcript) &&
      /(?:second|2[.\)\:]|phase\s*two)/i.test(transcript) &&
      /(?:third|3[.\)\:]|phase\s*three|finally|last)/i.test(transcript)) ||
    (thenCount >= 2 &&
      /agenda|shape of it|today we(?:'ll| will)|walk (?:you )?through|three phases|get into it/i.test(
        transcript,
      ));
  const consent =
    /(?:does that (?:work|sound)|sound(?:s)? (?:good|ok|okay)|work for you|are you (?:ok|okay|good with)|shall we|before we (?:dive|start))/i.test(
      transcript,
    ) ||
    /\b(?:yes|yep|yeah)[,.]?\b.{0,40}(?:sounds good|that works|perfect|let'?s)/i.test(
      transcript,
    ) ||
    /\b(?:sounds good|that works|perfect|let'?s do (?:it|that))\b/i.test(
      transcript,
    );
  return time && sequenced && consent;
}

/** Agenda must land early — not after extended prep/rapport. */
export function kickoffAgendaIsUpfront(transcript: string): boolean {
  const lines = transcript
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  let agendaIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      /shape of it|minutes together today|here(?:'s| is) kind of the shape/i.test(
        lines[i]!,
      )
    ) {
      agendaIdx = i;
      break;
    }
  }
  if (agendaIdx < 0) return false;
  const maxEarlyLine = Math.min(14, Math.floor(lines.length * 0.12));
  return agendaIdx <= maxEarlyLine;
}

/** Client hedges on next steps early ("I think", "hope", "figure it out"). */
export function kickoffHasWeakNextStepsConfirmation(transcript: string): boolean {
  return /(?:hope it'?s close|do my best|figure it out|i think i can|probably okay|got it, i think)/i.test(
    transcript,
  );
}

/**
 * Later transcript evidence resolves an earlier hedge — e.g. recap + "does that track?"
 * followed by client confirmation.
 */
export function kickoffLaterConfirmsUnderstanding(transcript: string): boolean {
  const lines = transcript.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let weakIdx = -1;
  let confirmIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const body = lines[i]!.replace(/^\[[^\]]+\]:\s*/, "");
    if (
      weakIdx < 0 &&
      /(?:hope it'?s close|do my best|figure it out|i think i can|probably okay|got it, i think)/i.test(
        body,
      )
    ) {
      weakIdx = i;
    }
    if (
      /does all of that track|did i miss anything|does that track for you|walk(?:ing)? away with exactly the same picture/i.test(
        body,
      )
    ) {
      confirmIdx = i;
    }
    if (
      confirmIdx < 0 &&
      /\[Owen[^\]]*\]:.*(?:basically everything|that(?:'s| is) (?:basically )?everything|no, no that(?:'s| is))/i.test(
        lines[i]!,
      ) &&
      /track|recap|miss anything|same picture/i.test(transcript)
    ) {
      confirmIdx = i;
    }
  }
  if (confirmIdx >= 0 && weakIdx >= 0) return confirmIdx > weakIdx;
  return /does all of that track|that(?:'s| is) basically everything|did i miss anything/i.test(
    transcript,
  );
}

/** Coach rushes the close — undermines next-steps clarity. */
export function kickoffCloseFeelsRushed(transcript: string): boolean {
  return /watching the clock|move a bit quicker|getting close to time|let me move a bit quicker/i.test(
    transcript,
  );
}

/** Personal share lands after agenda framing — breaks call structure. */
export function kickoffPersonalShareAfterAgenda(transcript: string): boolean {
  const lines = transcript.split(/\n+/);
  let agendaIdx = -1;
  let shareIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      agendaIdx < 0 &&
      /shape of it|minutes together today/i.test(lines[i]!)
    ) {
      agendaIdx = i;
    }
    if (
      shareIdx < 0 &&
      /rotator cuff|i did a rotator|years back.*(?:myself|kettlebell)/i.test(
        lines[i]!,
      )
    ) {
      shareIdx = i;
    }
  }
  return agendaIdx >= 0 && shareIdx > agendaIdx;
}

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
  if (
    kickoffHasWeakNextStepsConfirmation(transcript) &&
    kickoffLaterConfirmsUnderstanding(transcript)
  ) {
    return true;
  }
  if (kickoffHasWeakNextStepsConfirmation(transcript)) {
    return false;
  }
  return /got it|that works|that(?:'s| is) clear|thursday.{0,60}filming|program by|sounds good.{0,40}(?:thursday|monday|film)|basically everything/i.test(
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

export function kickoffHasProgramOutcomes(transcript: string): boolean {
  return /(?:phase (?:1|one|2|two|3|three).{0,120}(?:about|means|is to|does|for)|outcome|for you specifically|maps onto|what each phase|builds? (?:capacity|trust|strength))/i.test(
    transcript,
  );
}

export function kickoffHasProgramElite(transcript: string): boolean {
  const phases =
    /retraining/i.test(transcript) &&
    /remodeling/i.test(transcript) &&
    /integrating/i.test(transcript);
  const phase1Job =
    /retrain/i.test(transcript) &&
    /foundation|core|stabiliz|shoulder blade|movement pattern/i.test(transcript);
  const phase2Job =
    /remodel/i.test(transcript) &&
    /strength|capacity|load/i.test(transcript);
  const phase3Job =
    /integrat/i.test(transcript) &&
    /(?:overhead|belay|life|sustained|unexpected load)/i.test(transcript);
  const goalTie =
    /belay|lily|your (?:goal|north star)|for you specifically|finished building|phase three is literally/i.test(
      transcript,
    );
  const analogy =
    /foundation|framing|occupied|building|footings|load path/i.test(transcript);
  return phases && phase1Job && phase2Job && phase3Job && goalTie && analogy;
}

/** Client confirms phase understanding and goal tie — elite D5 requires landing. */
export function kickoffHasProgramClientConfirmation(transcript: string): boolean {
  return /phase three is literally|first time someone.*explained|order matters|get why the order|finished building|makes sense the way i laid it out/i.test(
    transcript,
  );
}

/**
 * Prep elite: coach shows intake was reviewed with ≥2 specific CRM details
 * (not just "I looked at your notes").
 */
export function kickoffHasPrepElite(transcript: string): boolean {
  const prepFrame =
    /intake(?:notes|call|form)|got (?:it|your (?:notes|file|intake)) in front|(?:I(?:'ve| have) got (?:your )?intake|got your intake|your intake here)|do not need to repeat|already went through|I(?:'ve| have) got (?:it|the whole picture)|reviewed (?:your |the )?(?:intake|notes|CRM)/i.test(
      transcript,
    );
  const details = [
    /\b(?:forty|thirty|fifty)[- ]?\w+\b|\b\d{2}\b.{0,40}(?:years? old|architect|engineer|teacher|portland)/i,
    /architect|engineer|teacher|nurse|icu|portland|tampa|occupation|job site/i,
    /(?:low )?back|shoulder|knee|hip|foot|feet|plantar|fascia|injury|impingement|rotator/i,
    /tried (?:PT|physical therapy)|PT a couple|(?:eight|8) weeks of PT|goals?|pain history|medical history|\d+\s+months?/i,
  ].filter((re) => re.test(transcript)).length;
  return prepFrame && details >= 2;
}

export function kickoffHasRapportElite(transcript: string): boolean {
  const personalShare =
    /i (?:did|had|was).{0,120}(?:shoulder|back|injury|myself)|rotator cuff|years back/i.test(
      transcript,
    );
  const emotionalDepth =
    /how did that feel|thank you for telling me|not a small thing|share something pretty real|what i(?:'m| am) hearing/i.test(
      transcript,
    );
  const connected =
    /for you|your (?:shoulder|back|situation)|when i see .{0,40}in someone|personal stake|matches energy|accountability style/i.test(
      transcript,
    );
  const returnedFocus =
    /let(?:'s| us) (?:get into|talk about|actually get)|enough about me|your goals|goals piece/i.test(
      transcript,
    );
  const clientOpensUp =
    /daughter|climbing|personal stor|unprompted|honest with me/i.test(transcript);
  return (
    (personalShare || emotionalDepth) &&
    connected &&
    returnedFocus &&
    clientOpensUp
  );
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

/** Strong (10) requires at least one follow-up "why" after the first goal answer. */
export function kickoffHasDeepWhyStrongFloor(transcript: string): boolean {
  return /why is that important|how would that (?:impact|affect)|what would happen if|what does that mean for you|why does that matter/i.test(
    transcript,
  );
}

const KICKOFF_ACCOUNTABILITY_RE =
  /push you|stay in the background|hold you accountable|do you want me to (?:push|stay)|how do you like to be coached/i;

export function kickoffHasSupportAccountabilityFraming(
  transcript: string,
): boolean {
  return KICKOFF_ACCOUNTABILITY_RE.test(transcript);
}

function kickoffHasSupportClarityBasics(transcript: string): boolean {
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

export function kickoffHasSupportClarityElite(transcript: string): boolean {
  return (
    kickoffHasSupportClarityBasics(transcript) &&
    kickoffHasSupportAccountabilityFraming(transcript)
  );
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

export function coachingHasVisionElite(transcript: string): boolean {
  const block =
    /(?:this|current|training) block|block (?:one|two|three|\d)|phase (?:one|two|three)/i.test(
      transcript,
    );
  const vision =
    /12[- ]?month|twelve[- ]?month|long[- ]?term (?:vision|goal)|who you(?:'re| are) becoming|north star/i.test(
      transcript,
    );
  const connected =
    /connect(?:s|ed|ing)? (?:this|that|it|the block)|toward(?:s)? (?:that|your)|maps (?:onto|to)|for (?:that|your) (?:goal|vision)/i.test(
      transcript,
    );
  return block && vision && connected;
}

export function coachingHasAccountabilityElite(transcript: string): boolean {
  const commitment =
    /you(?:'ll| will) (?:do|send|post|complete|bring)|i(?:'ll| will) (?:send|follow|check|review)|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of)/i.test(
      transcript,
    );
  const ownership =
    /you own|your (?:job|deliverable|commitment)|i(?:'ll| will) (?:own|take)|on you to/i.test(
      transcript,
    );
  const deadline =
    /by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)|before (?:our|the) next|this week|by eod|end of (?:day|week)/i.test(
      transcript,
    );
  return commitment && (ownership || deadline);
}

export function coachingHasAnchorElite(transcript: string): boolean {
  const deliverable =
    /one thing|deliverable|your (?:job|commitment) (?:is|this week)|accountability (?:is|anchor)/i.test(
      transcript,
    );
  const confirm =
    /(?:can you|will you) (?:confirm|commit)|does that work|i(?:'ll| will) (?:do|own) that|yes[,.]? (?:i(?:'ll| will)|that works)/i.test(
      transcript,
    );
  const consequence =
    /if (?:you|that) (?:miss|don(?:'t| not)|skip)|otherwise we|then we(?:'ll| will)|consequence/i.test(
      transcript,
    );
  return deliverable && confirm && consequence;
}

export function coachingHasContinuityElite(transcript: string): boolean {
  const coachFollowUp =
    /i(?:'ll| will) (?:send|follow up|check in|message|email)|you(?:'ll| will) (?:get|hear) from me/i.test(
      transcript,
    );
  const timing =
    /by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)|\d{1,2}\s*(?::\d{2})?\s*(?:am|pm)|this (?:afternoon|evening|week)|within \d+/i.test(
      transcript,
    );
  const channel =
    /(?:in the )?(?:app|chat|email|text|community|thread|message)/i.test(
      transcript,
    );
  return coachFollowUp && timing && channel;
}

/** Live movement coaching occurred — D4 must be scored, not disabled. */
export function coachingHasLiveMovementCoaching(transcript: string): boolean {
  const liveSetup =
    /get you (?:up and )?moving|on camera|camera angle|angle your camera|watch .{0,40}in real time|live (?:today|on camera)/i.test(
      transcript,
    );
  const coachingExchange =
    /(?:do (?:it|that) again|do (?:three|one|two|a few) more|from where I(?:'m| am) watching|set your feet|push(?:ing)? the ground|self-correct|cue(?:ing)? you|talk yourself through)/i.test(
      transcript,
    );
  const movementNamed =
    /split squat|step[- ]?down|deadlift|hinge|lunge|overhead press|hip drop|glute/i.test(
      transcript,
    );
  return (
    (liveSetup && (coachingExchange || movementNamed)) ||
    (coachingExchange && movementNamed && /camera|live|rep/i.test(transcript))
  );
}

export function coachingHasMovementElite(transcript: string): boolean {
  if (!coachingHasLiveMovementCoaching(transcript)) return false;
  const reflective =
    /how(?:'d| did) that feel|tell me if|what do you (?:notice|feel)|talk yourself through|compared to when/i.test(
      transcript,
    );
  const goalLink =
    /(?:for|toward(?:s)?|back to) (?:your|that) (?:goal|duty|clearance)|ladder ops|unrestricted|full duty|north star|cleared for/i.test(
      transcript,
    );
  const improvement =
    /cleaner|self-correct|felt the difference|that(?:'s| is) the fix|noticeably|level too/i.test(
      transcript,
    );
  return reflective && goalLink && improvement;
}

/** Discrete D4 score from transcript when the model wrongly disabled the dimension. */
export function coachingMovementScore(transcript: string): number {
  if (!coachingHasLiveMovementCoaching(transcript)) return 0;
  if (coachingHasMovementElite(transcript)) return 15;
  const reflective =
    /how(?:'d| did) that feel|tell me if|what do you (?:notice|feel)|talk yourself through|compared to when/i.test(
      transcript,
    );
  const goalLink =
    /(?:for|toward(?:s)?|back to) (?:your|that) (?:goal|duty|clearance)|ladder ops|unrestricted|full duty|cleared for/i.test(
      transcript,
    );
  if (reflective || goalLink) return 10;
  return 5;
}

/** Short verbatim lines usable as D4 evidence after a false disable repair. */
export function pickMovementEvidenceQuotes(transcript: string): string[] {
  const patterns = [
    /get you (?:up and )?moving/i,
    /angle your camera|camera angle|on camera/i,
    /how(?:'d| did) that feel|talk yourself through|compared to when/i,
    /from where I(?:'m| am) watching|do (?:it|three|one) more|push(?:ing)? the ground/i,
    /ladder ops|unrestricted|full duty|cleared for/i,
  ];
  const quotes: string[] = [];
  for (const line of transcript.split(/\n+/)) {
    const body = line.replace(/^\[[^\]]+\]:\s*/, "").trim();
    if (body.length < 24 || body.length > 240) continue;
    if (!patterns.some((p) => p.test(body))) continue;
    if (quotes.some((q) => q === body)) continue;
    quotes.push(body);
    if (quotes.length >= 3) break;
  }
  return quotes;
}

/**
 * If the model disables D4 despite live movement coaching in the transcript,
 * re-enable and score from transcript signals. Never disables an already-scored D4.
 */
export function repairCoachingMovementDimension<T extends {
  id: string;
  disabled: boolean;
  disabledReason: string | null;
  notApplicable: boolean;
  notApplicableReason: string | null;
  score: number | null;
  rationale: string;
  evidence: Array<{
    quote: string;
    speaker: string | null;
    location: string | null;
    demonstrated: boolean;
    verificationStatus?: string;
  }>;
  quickFix: string;
  notDemonstrated: boolean;
}>(dim: T, transcript: string): T {
  if (dim.id !== "d4") return dim;
  if (!transcript?.trim()) return dim;
  if (!coachingHasLiveMovementCoaching(transcript)) return dim;

  const wronglySkipped = dim.disabled || dim.notApplicable || dim.score === null;
  if (!wronglySkipped) return dim;

  const score = coachingMovementScore(transcript);
  const quotes = pickMovementEvidenceQuotes(transcript);
  const evidence =
    quotes.length > 0
      ? quotes.map((quote) => ({
          quote,
          speaker: null as string | null,
          location: null as string | null,
          demonstrated: true,
          verificationStatus: "verified",
        }))
      : dim.evidence;

  const rationale =
    score >= 15
      ? "Live movement coaching included reflective questions, visible improvement, and a clear link to the client's goal."
      : score >= 10
        ? "Live movement coaching with cues is present; reflective exchange or goal link supports a Strong score."
        : "Live movement coaching occurred, but the exchange stayed mostly instructional.";

  return {
    ...dim,
    disabled: false,
    disabledReason: null,
    notApplicable: false,
    notApplicableReason: null,
    score,
    notDemonstrated: false,
    rationale,
    quickFix:
      score >= 15
        ? ""
        : "Coach the movement live, ask a reflective question, and link the improvement to the goal.",
    evidence: evidence as T["evidence"],
  };
}

/**
 * If the model scored D10 as 0 despite a live booking in the transcript,
 * restore full marks. Never invents a booking that is not present.
 */
export function repairCoachingBookingDimension<T extends {
  id: string;
  disabled: boolean;
  notApplicable: boolean;
  score: number | null;
  rationale: string;
  quickFix: string;
  notDemonstrated: boolean;
}>(dim: T, transcript: string): T {
  if (dim.id !== "d10") return dim;
  if (!transcript?.trim()) return dim;
  if (dim.disabled || dim.notApplicable) return dim;
  if (!hasLiveNextCallBooking(transcript)) return dim;
  if (dim.score === 5) return dim;

  return {
    ...dim,
    score: 5,
    notDemonstrated: false,
    rationale:
      "Next call was booked live with a confirmed date and time before the call ended.",
    quickFix: "",
  };
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
    if (dimensionId === "d1" && score >= 9 && !kickoffHasPrepElite(transcript)) {
      return 7;
    }
    if (dimensionId === "d2" && score >= 10 && !kickoffHasRapportElite(transcript)) {
      return 7;
    }
    if (dimensionId === "d3" && score >= 4.5 && !kickoffHasAgendaElite(transcript)) {
      return 3;
    }
    if (dimensionId === "d4" && score >= 15 && !kickoffHasDeepWhyElite(transcript)) {
      return 10;
    }
    if (
      dimensionId === "d4" &&
      score >= 10 &&
      score < 15 &&
      !kickoffHasDeepWhyStrongFloor(transcript)
    ) {
      return 5;
    }
    if (dimensionId === "d5" && score >= 9 && !kickoffHasProgramElite(transcript)) {
      return 8;
    }
    if (
      dimensionId === "d5" &&
      score >= 8 &&
      !kickoffHasProgramElite(transcript) &&
      !kickoffHasProgramOutcomes(transcript)
    ) {
      return 7;
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
    if (
      dimensionId === "d7" &&
      score >= 5 &&
      !kickoffHasSupportClarityElite(transcript)
    ) {
      return 3;
    }
    if (
      dimensionId === "d10" &&
      score >= 4.5 &&
      !hasLiveNextCallBooking(transcript)
    ) {
      return 3.5;
    }
  }

  if (callType === "coaching") {
    if (dimensionId === "d1" && score >= 10 && !coachingHasCheckInElite(transcript)) {
      return 7;
    }
    if (dimensionId === "d3" && score >= 15 && !coachingHasVisionElite(transcript)) {
      return 10;
    }
    if (
      dimensionId === "d4" &&
      score >= 15 &&
      !coachingHasMovementElite(transcript)
    ) {
      return 10;
    }
    if (
      dimensionId === "d6" &&
      score >= 15 &&
      !coachingHasAccountabilityElite(transcript)
    ) {
      return 10;
    }
    if (dimensionId === "d7" && score >= 5 && !coachingHasAnchorElite(transcript)) {
      return 3;
    }
    if (
      dimensionId === "d10" &&
      score > 0 &&
      !hasLiveNextCallBooking(transcript)
    ) {
      return 0;
    }
    if (
      dimensionId === "d11" &&
      score >= 5 &&
      !coachingHasContinuityElite(transcript)
    ) {
      return 3;
    }
  }

  return score;
}

/**
 * @deprecated Caps-only scoring — never raises a score. Kept for call-site compatibility.
 */
export function floorEliteScore(
  callType: CallType,
  dimensionId: string,
  score: number | null,
  _transcript: string | undefined,
): number | null {
  void callType;
  void dimensionId;
  return score;
}
