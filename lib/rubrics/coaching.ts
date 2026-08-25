import { readFileSync } from "fs";
import path from "path";
import type { Rubric } from "./types";

function loadMarkdown(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

export const coachingRubric: Rubric = {
  id: "coaching",
  version: "coaching-v1",
  name: "Coaching Call",
  totalPoints: 100,
  sourceMarkdown: "",
  scoringNotes: [
    "Discrete scoring: each dimension score must be exactly one of the bucket values. No interpolation.",
    "Three pillars: Connection, Confidence, Continuity.",
    "D4 is optional — disable when no movement coaching occurred; then score out of 85 and report on 100 scale.",
    "D2 may be N/A on non-milestone calls — do not penalize; note and redistribute weight conceptually to D3/D4.",
    "D10 not booked live → hard 0, non-recoverable.",
    "If no struggle present → D8 scores 5 by default.",
    "If no adjustments needed → D5 scores 7 by default.",
  ],
  gradeBands: [
    { band: "Elite", min: 90, max: 100, description: "Client feels seen, challenged, connected to future self." },
    { band: "Strong", min: 80, max: 89, description: "Good call with isolated weaknesses." },
    { band: "Inconsistent", min: 70, max: 79, description: "Technically present but emotionally flat." },
    { band: "At risk", min: 60, max: 69, description: "Weak client experience." },
    { band: "Fail", min: 0, max: 59, description: "Core elements missing." },
  ],
  autoCaps: [
    {
      id: "next-call-not-booked",
      condition: "Next call NOT booked live during the call",
      dimensionId: "d10",
      forceDimensionScore: 0,
    },
    {
      id: "no-long-term-vision",
      condition: "No connection to long-term vision at any point in the call",
      dimensionId: "d3",
      maxDimensionScore: 10,
    },
    {
      id: "coach-monologue",
      condition: "Coach speaks >75% of the call (client passive/monologue)",
      maxTotal: 75,
    },
    {
      id: "no-accountability-commitment",
      condition:
        "No concrete accountability commitment the client owns before close",
      dimensionId: "d6",
      maxDimensionScore: 10,
    },
    {
      id: "struggle-ignored",
      condition: "Client struggle present but ignored or avoided",
      dimensionId: "d8",
      forceDimensionScore: 0,
    },
    {
      id: "no-action-steps",
      condition: "No action steps stated for either party before close",
      maxTotal: 70,
    },
  ],
  dimensions: [
    {
      id: "d1",
      name: "Check-In & Connection",
      maxScore: 10,
      description: "Genuine curiosity; gauge real state; set call intention.",
      scoringCriteria: "Elite 10 | Strong 7 | Surface 3 | Fail 0.",
      discreteScores: [0, 3, 7, 10],
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "Body + wins + struggles; reflects; tailored intention." },
        { name: "Strong", min: 7, max: 7, criteria: "Good questions; limited depth; generic intention." },
        { name: "Surface", min: 3, max: 3, criteria: "Surface check-in; no intention." },
        { name: "Fail", min: 0, max: 0, criteria: "Skipped or rushed." },
      ],
    },
    {
      id: "d2",
      name: "Diagnostics Review",
      maxScore: 10,
      mayBeNotApplicable: true,
      description:
        "When applicable (weeks 8/16/24), specific personalized feedback on 1–2 movements tied to goals.",
      scoringCriteria:
        "Elite 10 | Strong 7 | Surface 3 | Fail 0. If N/A this cycle, mark notApplicable — do not penalize.",
      discreteScores: [0, 3, 7, 10],
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "1–2 movements; anatomically precise; tied to goals." },
        { name: "Strong", min: 7, max: 7, criteria: "Good observations; incomplete goal link." },
        { name: "Surface", min: 3, max: 3, criteria: "Generic feedback." },
        { name: "Fail", min: 0, max: 0, criteria: "Skipped/rushed when applicable." },
      ],
    },
    {
      id: "d3",
      name: "Program Focus + Vision",
      maxScore: 15,
      description: "Connect current block to 12-month vision and identity.",
      scoringCriteria: "Elite 15 | Strong 10 | Mid 5 | Fail 0. No vision connection → max 10.",
      discreteScores: [0, 5, 10, 15],
      bands: [
        { name: "Elite", min: 15, max: 15, criteria: "Block explained + 12-month vision by name + belief." },
        { name: "Strong", min: 10, max: 10, criteria: "Connected to goals; vision generic." },
        { name: "Mid", min: 5, max: 5, criteria: "Logistics only; no long-term vision." },
        { name: "Fail", min: 0, max: 0, criteria: "No explanation of block." },
      ],
    },
    {
      id: "d4",
      name: "Movement Coaching Quality",
      maxScore: 15,
      optional: true,
      description:
        "Live movement coaching with reflective questions and goal link. Disable if no movement coaching occurred.",
      scoringCriteria: "Elite 15 | Strong 10 | Mid 5 | Fail 0. Optional — disable when N/A.",
      discreteScores: [0, 5, 10, 15],
      bands: [
        { name: "Elite", min: 15, max: 15, criteria: "Live coaching + reflective Qs + improvement + goal link." },
        { name: "Strong", min: 10, max: 10, criteria: "Clear cues; missing reflective Qs or goal link." },
        { name: "Mid", min: 5, max: 5, criteria: "Mostly telling; no exchange." },
        { name: "Fail", min: 0, max: 0, criteria: "No live coaching / commentary only." },
      ],
    },
    {
      id: "d5",
      name: "Adjustments & Strategy",
      maxScore: 10,
      description: "Adjustments framed as intelligent strategy protecting the long game.",
      scoringCriteria:
        "Elite 10 | Strong 7 | Surface 3 | Fail 0. If no adjustments needed → default 7.",
      discreteScores: [0, 3, 7, 10],
      bands: [
        { name: "Elite", min: 10, max: 10, criteria: "Clear rationale + protective framing." },
        { name: "Strong", min: 7, max: 7, criteria: "Explained; framing brief OR default when no adj needed." },
        { name: "Surface", min: 3, max: 3, criteria: "No clear rationale." },
        { name: "Fail", min: 0, max: 0, criteria: "Reactive/unexplained; demoralizing." },
      ],
    },
    {
      id: "d6",
      name: "Action Steps & Accountability",
      maxScore: 15,
      description: "Both sides leave with specific, time-bound, owned commitments.",
      scoringCriteria: "Elite 15 | Strong 10 | Mid 5 | Fail 0.",
      discreteScores: [0, 5, 10, 15],
      bands: [
        { name: "Elite", min: 15, max: 15, criteria: "Coach + client specific commitments with deadlines + ownership." },
        { name: "Strong", min: 10, max: 10, criteria: "Clear but lacks deadlines/measurability." },
        { name: "Mid", min: 5, max: 5, criteria: "Vague action steps." },
        { name: "Fail", min: 0, max: 0, criteria: "No clear next steps." },
      ],
    },
    {
      id: "d7",
      name: "Accountability Anchor",
      maxScore: 5,
      description: "Single-point (or progression-gated) client-owned deliverable with consequence.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Named/gated deliverable client confirms; consequence clear." },
        { name: "Mid", min: 3, max: 3, criteria: "Gestured at but not clearly gated." },
        { name: "Fail", min: 0, max: 0, criteria: "No accountability anchor." },
      ],
    },
    {
      id: "d8",
      name: "Struggle Handling",
      maxScore: 5,
      description: "Coach through difficulty; don't ignore. If no struggle → default 5.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0 (ignored struggle = hard 0). No struggle → 5.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Coaches through; reconnects to why; options; OR no struggle default." },
        { name: "Mid", min: 3, max: 3, criteria: "Acknowledges but surface." },
        { name: "Fail", min: 0, max: 0, criteria: "Ignored/minimized/defensive." },
      ],
    },
    {
      id: "d9",
      name: "Close Quality",
      maxScore: 5,
      description: "Emotional energy, specific celebration, directional clarity.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Specific celebration from THIS call + direction." },
        { name: "Mid", min: 3, max: 3, criteria: "Positive but generic." },
        { name: "Fail", min: 0, max: 0, criteria: "Abrupt; no reinforcement." },
      ],
    },
    {
      id: "d10",
      name: "Next Call Booking",
      maxScore: 5,
      description: "Booked LIVE before call ends — non-negotiable.",
      scoringCriteria: "Elite 5 | Fail 0. Not booked = automatic 0.",
      discreteScores: [0, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Booked live; date confirmed verbally." },
        { name: "Fail", min: 0, max: 0, criteria: "Not booked live." },
      ],
    },
    {
      id: "d11",
      name: "Continuity & Follow-Up Clarity",
      maxScore: 5,
      description: "Client knows exactly what happens after — coach deliverable with timing. Score in-call promise only.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Anchor restated + coach follow-up with specific timing." },
        { name: "Mid", min: 3, max: 3, criteria: "Vague timing." },
        { name: "Fail", min: 0, max: 0, criteria: "No post-call structure." },
      ],
    },
    {
      id: "d12",
      name: "Structure & Time Management",
      maxScore: 5,
      description: "Intentional flow through SOP sections; natural weaving, not robotic.",
      scoringCriteria: "Elite 5 | Mid 3 | Fail 0.",
      discreteScores: [0, 3, 5],
      bands: [
        { name: "Elite", min: 5, max: 5, criteria: "Natural flow; close/booking not rushed." },
        { name: "Mid", min: 3, max: 3, criteria: "Uneven pacing; one section rushed/bloated." },
        { name: "Fail", min: 0, max: 0, criteria: "Disorganized; core sections missing." },
      ],
    },
  ],
};

export function getCoachingRubric(): Rubric {
  if (!coachingRubric.sourceMarkdown) {
    coachingRubric.sourceMarkdown = loadMarkdown("rubrics/coaching-call-rubric.md");
  }
  return coachingRubric;
}
