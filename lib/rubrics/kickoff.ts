import type { Rubric } from "./types";
import { loadKickoffMarkdown } from "./loadMarkdown";

export const kickoffRubric: Rubric = {
  id: "kickoff",
  version: "kickoff-v1",
  name: "Kick-off Call",
  totalPoints: 100,
  sourceMarkdown: "",
  scoringNotes: [
    "Band-based scoring: each dimension score must fall inside one of the listed bands.",
    "Within a band, any integer works (or a half step where max ≤ 5).",
    "Every score grounded in direct transcript evidence — never assumptions or mood.",
    "Quote-first rationale. If behaviour not verifiable, score lower tier of the correct band — do not collapse bands.",
    "D7 and D12 score what is communicated in-call, not post-call delivery.",
  ],
  gradeBands: [
    { band: "Elite", min: 90, max: 100, description: "Deep + clear + client confirms." },
    { band: "Strong", min: 80, max: 89, description: "Clear and useful but lacks emotional depth." },
    { band: "Inconsistent", min: 70, max: 79, description: "Technically correct but generic/surface." },
    { band: "At risk", min: 60, max: 69, description: "Weak client experience." },
    { band: "Fail", min: 0, max: 59, description: "Missed core elements, major retention risk." },
  ],
  autoCaps: [
    {
      id: "no-follow-ups",
      condition: "No follow-up questions anywhere in the call",
      maxTotal: 70,
    },
    {
      id: "coach-monologue",
      condition: "Coach speaks >70% of the time without client engagement",
      maxTotal: 80,
    },
    {
      id: "unresolved-confusion",
      condition: "Client shows unresolved confusion at any point",
      maxTotal: 75,
    },
    {
      id: "no-north-star",
      condition: "No North Star statement constructed",
      dimensionId: "d4",
      maxDimensionScore: 10,
    },
  ],
  dimensions: [
    {
      id: "d1",
      name: "Pre-Call Preparation",
      maxScore: 10,
      description:
        "Does the coach demonstrate they reviewed the sales notes BEFORE the call? Score on conduct, not disclosure.",
      scoringCriteria:
        "Elite 9–10 | Strong 6–8 | Mid 4–5 | Weak 1–3 | Fail 0. Credit specific goals/pain/history even without 'I read your notes'.",
      quickFixAction:
        "Name two intake details (goals, injury, or history) in the first minutes so prep is obvious.",
      bands: [
        { name: "Elite", min: 9, max: 10, criteria: "Fully reviewed intake; specific goals+name+injuries early; ≥2 CRM details." },
        { name: "Strong", min: 6, max: 8, criteria: "Clear prep evidence with a small gap." },
        { name: "Mid", min: 4, max: 5, criteria: "Partial preparation; redundant questions." },
        { name: "Weak", min: 1, max: 3, criteria: "Minimal preparation visible." },
        { name: "Fail", min: 0, max: 0, criteria: "Clearly unprepared; resets the sale." },
      ],
    },
    {
      id: "d2",
      name: "Rapport & Tone",
      maxScore: 10,
      description:
        "Genuine human connection; energy match; client opens up. Elite includes a relevant personal share — not extra small talk.",
      scoringCriteria: "Discrete-ish: Elite 10 | Strong 7 | Mid 3 | Fail 0. Prefer these buckets.",
      quickFixAction:
        "Share one relevant personal beat, then pause so the client can open up.",
      discreteScores: [0, 3, 7, 10],
      positiveSignals: [
        "Client shares personal stories unprompted",
        "Natural laughter",
        "Client says they like how the coach showed up",
      ],
      negativeSignals: [
        "Awkward silences",
        "Monosyllabic client responses",
        "Coach talks about themselves excessively",
      ],
      bands: [
        {
          name: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Warm, personalized, matches energy; shares something personal and relevant; client opens up spontaneously with personal stories.",
        },
        { name: "Strong", min: 7, max: 7, criteria: "Friendly but surface-level." },
        { name: "Mid", min: 3, max: 3, criteria: "Mechanical / scripted." },
        { name: "Fail", min: 0, max: 0, criteria: "Cold, rushed, skips rapport." },
      ],
    },
    {
      id: "d3",
      name: "Agenda Framing",
      maxScore: 5,
      description: "Coach takes control of call structure upfront with time framing and sequenced phases.",
      scoringCriteria: "Elite 4.5–5 | Mid 2.5–3.5 | Weak 1–2 | Fail 0. Numbered list NOT required.",
      quickFixAction:
        "State the time, list three sequenced phases, and get a yes before diving in.",
      bands: [
        { name: "Elite", min: 4.5, max: 5, criteria: "Time + ≥3 sequenced phases + client consent." },
        { name: "Mid", min: 2.5, max: 3.5, criteria: "Partial agenda." },
        { name: "Weak", min: 1, max: 2, criteria: "Brief/fragmented mention." },
        { name: "Fail", min: 0, max: 0, criteria: "No upfront structure." },
      ],
    },
    {
      id: "d4",
      name: "Goal Alignment & Deep Why",
      maxScore: 15,
      description: "Go beyond functional goals to emotional/identity driver; build North Star.",
      scoringCriteria: "Elite 15 | Strong 10 | Mid 5 | Fail 0. No North Star → max 10.",
      quickFixAction:
        "Name the emotional why, build a North Star, and lock a 30-day metric the client confirms.",
      discreteScores: [0, 5, 10, 15],
      bands: [
        { name: "Elite", min: 15, max: 15, criteria: "Emotional drivers + North Star + 30-day metric + client confirms." },
        { name: "Strong", min: 10, max: 10, criteria: "Goals understood but surface; North Star implied." },
        { name: "Mid", min: 5, max: 5, criteria: "Repeats sales notes; physical only." },
        { name: "Fail", min: 0, max: 0, criteria: "No meaningful alignment." },
      ],
    },
    {
      id: "d5",
      name: "Program Explanation (3 Phases)",
      maxScore: 10,
      description:
        "Client understands 3-phase Halden Method structure (Retraining → Remodeling → Integrating or equivalents).",
      scoringCriteria: "Elite 9–10 | Strong 6–8 | Mid 3–5 | Weak 1–2 | Fail 0.",
      quickFixAction:
        "Walk all three phases with outcomes, an analogy, and a tie back to their goals.",
      bands: [
        { name: "Elite", min: 9, max: 10, criteria: "All 3 phases + outcomes + analogy/cadence + tied to goals." },
        { name: "Strong", min: 6, max: 8, criteria: "All 3 phases correct order; simpler delivery." },
        { name: "Mid", min: 3, max: 5, criteria: "Fragmented; 1–2 phases vague." },
        { name: "Weak", min: 1, max: 2, criteria: "Only vague 'phases/steps'." },
        { name: "Fail", min: 0, max: 0, criteria: "Skipped or misrepresented." },
      ],
    },
    {
      id: "d6",
      name: "Journey & Expectation Setting",
      maxScore: 10,
      description: "Prepare client emotionally for difficulty; normalize valleys.",
      scoringCriteria: "Elite 10 | Strong 7 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 7, 10],
      quickFixAction:
        "Name the valleys ahead and separate good pain from bad pain so they are emotionally ready.",
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "Milestones + emotional friction + valleys + good vs bad pain." },
        { name: "Strong", min: 7, max: 7, criteria: "Basics covered; misses emotional prep." },
        { name: "Mid", min: 3, max: 3, criteria: "Vague expectations; instructional only." },
        { name: "Fail", min: 0, max: 0, criteria: "No expectation setting." },
      ],
    },
    {
      id: "d7",
      name: "Support System Clarity",
      maxScore: 5,
      description: "How client is supported between sessions — channel, response time, community, accountability.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0. Score what is said in-call.",
      quickFixAction:
        "Spell out channel, response time, community, and how they will be held accountable.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Channels + response time + community + accountability framing." },
        { name: "Mid", min: 3, max: 3, criteria: "Mentions support but unclear usage." },
        { name: "Fail", min: 0, max: 0, criteria: "Not explained." },
      ],
    },
    {
      id: "d8",
      name: "Coaching Intelligence Questions",
      maxScore: 10,
      description: "Behavioral patterns, psychology, personalization beyond logistics.",
      scoringCriteria: "Elite 10 | Strong 7 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 7, 10],
      quickFixAction:
        "Ask a behavioral and a self-awareness question, then change the plan from the answer.",
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "Behavioral + self-awareness questions; personalizes approach." },
        { name: "Strong", min: 7, max: 7, criteria: "1–2 questions; lacks depth." },
        { name: "Mid", min: 3, max: 3, criteria: "Generic/logistical only." },
        { name: "Fail", min: 0, max: 0, criteria: "Skipped." },
      ],
    },
    {
      id: "d9",
      name: "Next Steps & Diagnostics",
      maxScore: 10,
      description: "Client knows exactly what to do and when (diagnostics → film → upload → program).",
      scoringCriteria: "Elite 10 | Strong 7 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 7, 10],
      quickFixAction:
        "Confirm the diagnostic → film → upload pipeline with a how-to and a timeline they repeat back.",
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "Clear pipeline + filming how-to + timeline + client confirms." },
        { name: "Strong", min: 7, max: 7, criteria: "Clear but minor confusion / no demo." },
        { name: "Mid", min: 3, max: 3, criteria: "Vague instructions; unresolved doubts." },
        { name: "Fail", min: 0, max: 0, criteria: "No clear next steps." },
      ],
    },
    {
      id: "d10",
      name: "Booking Next Call",
      maxScore: 5,
      description: "Next call booked LIVE — verbal date/time confirmation is the test.",
      scoringCriteria: "Elite 4.5–5 | Mid 2.5–3.5 | Weak 1–2 | Fail 0.",
      quickFixAction:
        "Get a verbal date and time for the next call before hanging up.",
      bands: [
        { name: "Elite", min: 4.5, max: 5, criteria: "Date+time confirmed verbally; constraints handled live." },
        { name: "Mid", min: 2.5, max: 3.5, criteria: "Attempted but not fully secured." },
        { name: "Weak", min: 1, max: 2, criteria: "Referenced only in passing." },
        { name: "Fail", min: 0, max: 0, criteria: "Not addressed." },
      ],
    },
    {
      id: "d11",
      name: "Close, Recap & Confidence",
      maxScore: 5,
      description: "Ends with energy, structured recap, emotional anchor — not just logistics.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0. No structured recap → max 3.",
      quickFixAction:
        "Close with a structured recap and an emotional confidence anchor, not only logistics.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Structured recap + confidence anchor + emotional reinforcement." },
        { name: "Mid", min: 3, max: 3, criteria: "Positive but no structured recap / generic." },
        { name: "Fail", min: 0, max: 0, criteria: "Abrupt or flat ending." },
      ],
    },
    {
      id: "d12",
      name: "Post-Call Execution",
      maxScore: 5,
      description: "In-call commitments to post-call deliverables with deadlines. Delivery verification out of scope.",
      scoringCriteria: "Elite 4.5–5 | Strong 3.5–4 | Mid 2–3 | Weak 1 | Fail 0.",
      quickFixAction:
        "Commit to specific post-call deliverables with precise deadlines.",
      bands: [
        { name: "Elite", min: 4.5, max: 5, criteria: "Multiple explicit commitments with precise deadlines." },
        { name: "Strong", min: 3.5, max: 4, criteria: "Two+ commitments with mostly precise timing." },
        { name: "Mid", min: 2, max: 3, criteria: "At least one specific commitment; soft timing ok." },
        { name: "Weak", min: 1, max: 1, criteria: "Vague follow-up reference." },
        { name: "Fail", min: 0, max: 0, criteria: "No post-call commitments." },
      ],
    },
  ],
};

// Lazy-load markdown so build doesn't fail if cwd differs at import time in edge cases
export function getKickoffRubric(): Rubric {
  if (!kickoffRubric.sourceMarkdown) {
    kickoffRubric.sourceMarkdown = loadKickoffMarkdown();
  }
  return kickoffRubric;
}
