import { readFileSync, writeFileSync } from "fs";
import {
  kickoffHasAgendaElite,
  kickoffHasRapportElite,
  kickoffHasDeepWhyElite,
  kickoffHasProgramElite,
  kickoffHasJourneyElite,
  kickoffHasNextStepsElite,
  kickoffHasNextStepsHowTo,
  kickoffHasNextStepsPipeline,
  kickoffHasNextStepsTimeline,
  kickoffHasNextStepsConfirmation,
} from "../lib/scoring/eliteBar";
import {
  kickoffHasStructuredRecap,
  kickoffHasEliteClose,
  kickoffHasPostCallCommitment,
  kickoffPostCallFloor,
  kickoffHasSupportClarity,
} from "../lib/scoring/kickoffClose";
import { hasLiveNextCallBooking } from "../lib/scoring/detectCaps";

const t = readFileSync("transcripts/kickoff-01.txt", "utf8");
const out = {
  agenda: kickoffHasAgendaElite(t),
  rapport: kickoffHasRapportElite(t),
  deepWhy: kickoffHasDeepWhyElite(t),
  program: kickoffHasProgramElite(t),
  journey: kickoffHasJourneyElite(t),
  nextSteps: kickoffHasNextStepsElite(t),
  howTo: kickoffHasNextStepsHowTo(t),
  pipeline: kickoffHasNextStepsPipeline(t),
  timeline: kickoffHasNextStepsTimeline(t),
  confirm: kickoffHasNextStepsConfirmation(t),
  recap: kickoffHasStructuredRecap(t),
  eliteClose: kickoffHasEliteClose(t),
  postCall: kickoffHasPostCallCommitment(t),
  postFloor: kickoffPostCallFloor(t),
  support: kickoffHasSupportClarity(t),
  booking: hasLiveNextCallBooking(t),
};
writeFileSync("qa-output/kickoff-01-detectors.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
