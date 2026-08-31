/**
 * Rule-level rubric evaluation: FULL TRANSCRIPT → verified quote → rule result.
 * Separate from dimension scoring heuristics — used for audit UI and consistency checks.
 */

import type {
  CallType,
  CriterionResult,
  CriterionStatus,
  DimensionResult,
} from "@/lib/rubrics/types";
import { hasLiveNextCallBooking } from "@/lib/scoring/detectCaps";
import {
  kickoffHasAgendaElite,
  kickoffHasCoachingIntelElite,
  kickoffHasDeepWhyStrongFloor,
  kickoffHasJourneyElite,
  kickoffHasNextStepsElite,
  kickoffHasPrepElite,
  kickoffHasProgramClientConfirmation,
  kickoffHasProgramElite,
  kickoffHasSupportClarityElite,
  kickoffLaterConfirmsUnderstanding,
} from "@/lib/scoring/eliteBar";
import {
  kickoffHasEliteClose,
  kickoffHasPostCallCommitment,
  kickoffHasStructuredRecap,
} from "@/lib/scoring/kickoffClose";
import { quoteExistsInTranscript } from "@/lib/transcripts/quoteMatch";

type RuleEval = {
  status: CriterionStatus;
  note: string;
  evidenceQuote: string | null;
  evidenceSpeaker: string | null;
};

type RuleDef = {
  id: string;
  label: string;
  requiredForElite: boolean;
  evaluate: (transcript: string, callType: CallType) => RuleEval;
};

function clipQuote(body: string, maxChars = 280): string {
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

function findLineMatching(
  transcript: string,
  pattern: RegExp,
): { quote: string; speaker: string | null } | null {
  for (const line of transcript.split(/\n+/)) {
    const trimmed = line.replace(/\r$/, "").trim();
    const match = trimmed.match(/^\[([^\]]+)\]:\s*(.+)$/);
    const speaker = match?.[1]?.trim() ?? null;
    const body = match?.[2]?.trim() ?? trimmed;
    if (!pattern.test(body)) continue;
    const quote = clipQuote(body);
    if (!quoteExistsInTranscript(quote.replace(/…$/, ""), transcript)) {
      if (!quoteExistsInTranscript(body.slice(0, 120), transcript)) continue;
      return { quote: clipQuote(body.slice(0, 240)), speaker };
    }
    return { quote, speaker };
  }
  return null;
}

function met(
  transcript: string,
  pattern: RegExp,
  note: string,
): RuleEval {
  const hit = findLineMatching(transcript, pattern);
  return {
    status: "met",
    note,
    evidenceQuote: hit?.quote ?? null,
    evidenceSpeaker: hit?.speaker ?? null,
  };
}

function ruleFromDetector(
  metCondition: boolean,
  transcript: string,
  pattern: RegExp,
  metNote: string,
  failNote: string,
): RuleEval {
  if (metCondition) {
    return met(transcript, pattern, metNote);
  }
  return {
    status: "not_met",
    note: failNote,
    evidenceQuote: null,
    evidenceSpeaker: null,
  };
}

const KICKOFF_RULES: Record<string, RuleDef[]> = {
  d1: [
    {
      id: "d1-prep-visible",
      label: "Prep visible before re-asking history",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasPrepElite(t),
          t,
          /got (?:it|the whole picture) in front|do not need to repeat|already went through/i,
          "Coach showed intake was reviewed and did not make the client repeat their full story.",
          "Rubric requires visible prep with specific intake details in the opening — not a generic restart.",
        ),
    },
    {
      id: "d1-crm-details",
      label: "≥2 specific CRM/intake details referenced",
      requiredForElite: true,
      evaluate: (t) => {
        const details = [
          /forty-four|architect|portland/i,
          /six years|eighteen months|shoulder|back/i,
          /PT a couple|physical therapy/i,
        ].filter((re) => re.test(t)).length;
        if (details >= 2) {
          return met(
            t,
            /forty-four|architect|portland|six years|PT/i,
            "At least two specific intake details (goals, injury, history, context) were referenced naturally.",
          );
        }
        return {
          status: "not_met",
          note: "Rubric requires at least two specific intake details from sales notes — not surface-level intro only.",
          evidenceQuote: null,
          evidenceSpeaker: null,
        };
      },
    },
  ],
  d2: [
    {
      id: "d2-personal-relevant",
      label: "Relevant personal share + return to client",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          /rotator cuff|kettlebell|years back/i.test(t) &&
            /let(?:'s| us) (?:get into|actually get)|goals piece/i.test(t),
          t,
          /rotator cuff|kettlebell/i,
          "Coach shared a relevant personal experience and returned focus to the client's goals.",
          "Rubric requires a relevant personal share that returns focus to the client — not coach monologue.",
        ),
    },
    {
      id: "d2-client-opens",
      label: "Client opens up with personal/emotional depth",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          /daughter|climbing|belay|share something pretty real/i.test(t),
          t,
          /daughter|climbing gym|belay my own kid/i,
          "Client shared unprompted personal/emotional context beyond logistics.",
          "Rubric requires the client to open up spontaneously — surface answers are not Elite rapport.",
        ),
    },
  ],
  d3: [
    {
      id: "d3-time-phases-consent",
      label: "Time + ≥3 phases + client consent",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasAgendaElite(t),
          t,
          /forty-five minutes|shape of it|sound good to you/i,
          "Coach stated time, sequenced phases, and received client consent before proceeding.",
          "Rubric requires explicit time framing, at least three sequenced phases, and client buy-in.",
        ),
    },
  ],
  d4: [
    {
      id: "d4-why-probes",
      label: "Emotional why probed (not surface goal only)",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasDeepWhyStrongFloor(t),
          t,
          /why is that important|what would happen if nothing changes/i,
          "Coach probed beyond the surface goal with follow-up why questions.",
          "Rubric requires probing the emotional why — accepting the first physical goal is Mid at best.",
        ),
    },
    {
      id: "d4-north-star",
      label: "North Star stated back and confirmed",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          /north star|belay partner|what i(?:'m| am) hearing.*dad who/i.test(t) &&
            /that(?:'s| is) exactly/i.test(t),
          t,
          /north star|belay partner|what i(?:'m| am) hearing/i,
          "Coach built a North Star statement and the client confirmed it.",
          "Rubric requires a stated-back North Star with client confirmation — implied goals are not enough.",
        ),
    },
    {
      id: "d4-day30",
      label: "Concrete 30-day success markers",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          /day thirty|thirty days|ninety-minute meeting|high shelf/i.test(t) &&
            /writing that down|word for word|two flags we're planting/i.test(t),
          t,
          /day thirty|ninety-minute|high shelf/i,
          "Coach locked concrete 30-day markers the client could verify yes/no.",
          "Rubric requires specific 30-day markers — vague 'feel better' is not Elite.",
        ),
    },
  ],
  d5: [
    {
      id: "d5-three-phases-explained",
      label: "Three phases with job/outcome/analogy",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasProgramElite(t),
          t,
          /retraining|remodeling|integrating|foundation|framing/i,
          "All three phases were explained with job, outcome, and building analogy tied to the client.",
          "Rubric requires more than naming phases — each phase needs job, outcome, and client tie.",
        ),
    },
    {
      id: "d5-client-confirms",
      label: "Client confirms phase understanding",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasProgramClientConfirmation(t),
          t,
          /order matters|phase three is literally|makes sense the way/i,
          "Client confirmed they understood why the phase order matters.",
          "Rubric requires client confirmation that the program structure landed — not coach monologue only.",
        ),
    },
  ],
  d6: [
    {
      id: "d6-journey-prep",
      label: "Valley + foundational framing + pain distinction",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasJourneyElite(t),
          t,
          /foundational.{0,40}not transformational|valley|good discomfort/i,
          "Coach prepared the client for valleys, foundational month one, and good vs bad pain.",
          "Rubric requires valley warning, foundational-not-transformational framing, and good vs bad pain.",
        ),
    },
  ],
  d7: [
    {
      id: "d7-support-clarity",
      label: "Channel + response time + community",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasSupportClarityElite(t),
          t,
          /training app|twenty-four hours|community platform/i,
          "Support channel, response-time promise, community, and accountability framing were clear.",
          "Rubric requires app channel, response timing, community access, and proactive accountability framing.",
        ),
    },
  ],
  d8: [
    {
      id: "d8-coaching-intel",
      label: "Behavioral + learning-style probes used",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasCoachingIntelElite(t),
          t,
          /slow fade|learn best|push me/i,
          "Coach asked behavioral pattern and learning-style questions and used the answers.",
          "Rubric requires behavioral and learning-style intelligence — logistics-only questions are not Elite.",
        ),
    },
  ],
  d9: [
    {
      id: "d9-next-steps-pipeline",
      label: "Diagnostics pipeline + timeline + how-to",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasNextStepsElite(t),
          t,
          /diagnostic|film|upload|by thursday|program by saturday/i,
          "Client received diagnostic → film → upload → program → start with deadlines and filming guidance.",
          "Rubric requires full next-steps pipeline with timeline and how-to — not 'I'll send stuff'.",
        ),
    },
    {
      id: "d9-understanding-verified",
      label: "Client understanding verified (incl. later recap)",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffLaterConfirmsUnderstanding(t),
          t,
          /does all of that track|basically everything|got it.*thursday/i,
          "Client understanding was verified, including via the closing recap when needed.",
          "Rubric requires verified understanding of what/how/where/by when — early hedges must be resolved later in the call.",
        ),
    },
  ],
  d10: [
    {
      id: "d10-live-booking",
      label: "Next call booked live with date + time",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          hasLiveNextCallBooking(t),
          t,
          /calendar invite|lock that in|thursday the eleventh|three o'clock|book(?:ed|ing) it now/i,
          "Next call date and time were confirmed verbally before hang-up (invite or explicit lock-in).",
          "Rubric requires live verbal date/time confirmation — deferring to assistant/link-only is not Elite.",
        ),
    },
  ],
  d11: [
    {
      id: "d11-structured-recap",
      label: "Structured recap of call substance",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasStructuredRecap(t),
          t,
          /quick recap|so — today we reconnected|did i miss anything/i,
          "Coach delivered a structured recap covering goals, next steps, and support — not logistics only.",
          "Rubric requires a structured recap before close — flat 'talk soon' is Mid at best.",
        ),
    },
    {
      id: "d11-confidence-anchor",
      label: "Confidence + emotional anchor at close",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          kickoffHasEliteClose(t),
          t,
          /right place|excited to get going|kind of client who actually gets/i,
          "Close included confidence anchor and emotional reinforcement, not logistics alone.",
          "Rubric requires confidence and emotional anchor at close — logistics-only ending caps below Elite.",
        ),
    },
  ],
  d12: [
    {
      id: "d12-timed-commitments",
      label: "≥2 in-call post-call commitments with timing",
      requiredForElite: true,
      evaluate: (t) => {
        const count =
          Number(/i(?:'m| am) assigning/i.test(t)) +
          Number(/recap message|recap .{0,20}(?:fifteen|15|\d+) minutes/i.test(t)) +
          Number(/program(?:'s| is) (?:loaded|ready)|by saturday|by monday/i.test(t));
        if (kickoffHasPostCallCommitment(t) && count >= 2) {
          return met(
            t,
            /assigning your diagnostics|recap message|program.*by/i,
            `Coach made ${count}+ timed in-call post-call commitments (diagnostics, recap, program).`,
          );
        }
        return {
          status: count >= 1 ? "partial" : "not_met",
          note:
            count >= 1
              ? "Rubric Elite requires multiple timed post-call commitments — only one soft commitment found."
              : "Rubric requires in-call post-call deliverables with timing — none stated.",
          evidenceQuote:
            findLineMatching(t, /assigning|recap message|program.*by/i)?.quote ??
            null,
          evidenceSpeaker:
            findLineMatching(t, /assigning|recap message|program.*by/i)
              ?.speaker ?? null,
        };
      },
    },
  ],
};

const COACHING_RULES: Record<string, RuleDef[]> = {
  d10: [
    {
      id: "d10-live-booking",
      label: "Next call booked live with date + time",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          hasLiveNextCallBooking(t),
          t,
          /lock that in|wednesday the 10th|tuesday the|four o'clock|calendar/i,
          "Next call date and time were confirmed verbally before hang-up.",
          "Rubric requires live booking with confirmed date/time — 'I'll send times later' without verbal lock is Fail/Mid.",
        ),
    },
  ],
  d6: [
    {
      id: "d6-accountability",
      label: "Commitments with owner, deadline, consequence",
      requiredForElite: true,
      evaluate: (t) =>
        ruleFromDetector(
          /from your side|from my side|by thursday|before cycle|miss consequence|if you miss/i.test(
            t,
          ),
          t,
          /from your side|by thursday|before cycle/i,
          "Coach and client commitments included owners and deadlines.",
          "Rubric requires specific commitments with owners, deadlines, and confirmation.",
        ),
    },
  ],
  d9: [
    {
      id: "d9-deadlines",
      label: "Later deadlines referenced in close (not ignored)",
      requiredForElite: true,
      evaluate: (t) => {
        const early = /by thursday|before cycle five|three-week schedule/i.test(t);
        const recap =
          /recap everything|before we hop off|rough-shift version lands/i.test(t);
        if (early && recap) {
          return met(
            t,
            /recap everything|rough-shift version lands|by thursday/i,
            "Closing recap restated deadlines and deliverables stated earlier in the call.",
          );
        }
        return {
          status: early ? "partial" : "not_met",
          note: early
            ? "Rubric requires later recap to confirm deadlines — early commitments were not fully closed out."
            : "Rubric requires clear deadlines for client deliverables.",
          evidenceQuote:
            findLineMatching(t, /by thursday|before cycle/i)?.quote ?? null,
          evidenceSpeaker:
            findLineMatching(t, /by thursday|before cycle/i)?.speaker ?? null,
        };
      },
    },
  ],
};

export function evaluateDimensionCriteria(
  dim: DimensionResult,
  transcript: string,
  callType: CallType,
): CriterionResult[] {
  if (dim.disabled || dim.notApplicable || !transcript.trim()) return [];

  const rules =
    callType === "kickoff"
      ? (KICKOFF_RULES[dim.id] ?? [])
      : (COACHING_RULES[dim.id] ?? []);

  return rules.map((rule) => {
    const result = rule.evaluate(transcript, callType);
    return {
      id: rule.id,
      label: rule.label,
      requiredForElite: rule.requiredForElite,
      status: result.status,
      note: result.note,
      evidenceQuote: result.evidenceQuote,
      evidenceSpeaker: result.evidenceSpeaker,
    };
  });
}

export function criteriaSummary(criteria: CriterionResult[]): string {
  if (criteria.length === 0) return "";
  const met = criteria.filter((c) => c.status === "met").length;
  const partial = criteria.filter((c) => c.status === "partial").length;
  const failed = criteria.filter((c) => c.status === "not_met").length;
  return `${met} met · ${partial} partial · ${failed} not met`;
}

export function eliteCriteriaGaps(criteria: CriterionResult[]): CriterionResult[] {
  return criteria.filter(
    (c) =>
      c.requiredForElite &&
      (c.status === "not_met" || c.status === "partial"),
  );
}

export function eliteCriteriaAllMet(criteria: CriterionResult[]): boolean {
  const elite = criteria.filter((c) => c.requiredForElite);
  if (elite.length === 0) return true;
  return elite.every((c) => c.status === "met");
}

export function whyNotFullMarksFromCriteria(
  criteria: CriterionResult[],
): string | null {
  const gaps = eliteCriteriaGaps(criteria);
  if (gaps.length === 0) return null;
  return gaps.map((g) => g.note).join(" ");
}

export function repeatStrengthsFromCriteria(
  criteria: CriterionResult[],
): string | null {
  const met = criteria.filter((c) => c.status === "met" && c.requiredForElite);
  if (met.length === 0) return null;
  return met
    .slice(0, 3)
    .map((c) => c.label.toLowerCase())
    .join(", ");
}
