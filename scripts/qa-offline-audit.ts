/**
 * Offline evidence / scoring audits that do not require a live model.
 * Verifies quote matcher + rubric maxima math against the four transcripts.
 */
import { getKickoffRubric } from "../lib/rubrics/kickoff";
import { getCoachingRubric } from "../lib/rubrics/coaching";
import { gradeFromScore, normalizeToHundred } from "../lib/scoring/calculate";
import {
  quoteExistsInTranscript,
  needsChunking,
  chunkTranscript,
  validateTranscriptLength,
} from "../lib/transcripts/handling";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const out: string[] = [];
function log(s: string) {
  out.push(s);
  console.log(s);
}

const kickoff = getKickoffRubric();
const coaching = getCoachingRubric();

log("=== Rubric maxima ===");
const kSum = kickoff.dimensions.reduce((a, d) => a + d.maxScore, 0);
const cSum = coaching.dimensions.reduce((a, d) => a + d.maxScore, 0);
const cSumNoD4 = coaching.dimensions
  .filter((d) => d.id !== "d4")
  .reduce((a, d) => a + d.maxScore, 0);
log(`kickoff max sum=${kSum} (expected 100)`);
log(`coaching max sum=${cSum} (prose says 100; table=${cSum})`);
log(`coaching without D4=${cSumNoD4} (prose says 85; table=${cSumNoD4})`);

log("\n=== Grade bands ===");
for (const s of [100, 90, 89, 80, 79, 70, 69, 60, 59, 0]) {
  log(`score ${s} → ${gradeFromScore(s, kickoff)}`);
}

log("\n=== Transcript paths ===");
for (const f of [
  "kickoff-01.txt",
  "kickoff-02.txt",
  "coaching-01.txt",
  "coaching-02.txt",
]) {
  const t = readFileSync(path.join("transcripts", f), "utf8");
  const chunks = chunkTranscript(t);
  log(
    `${f}: chars=${t.length} valid=${validateTranscriptLength(t).ok} needsChunking=${needsChunking(t)} chunks=${chunks.length}`,
  );
}

log("\n=== Quote matcher smoke (kickoff-01) ===");
const k1 = readFileSync("transcripts/kickoff-01.txt", "utf8");
const real = "you do not need to repeat all of that for me";
const fake = "We booked a Hawaiian vacation and adopted a golden retriever";
log(`real quote found=${quoteExistsInTranscript(real, k1)}`);
log(`fake quote found=${quoteExistsInTranscript(fake, k1)}`);

log("\n=== Quote matcher smoke (kickoff-02 trap) ===");
const k2 = readFileSync("transcripts/kickoff-02.txt", "utf8");
const inventedNorthStar =
  "What I hear you saying is you want to be the nurse who can finish a twelve-hour shift without limping";
log(
  `invented North Star found=${quoteExistsInTranscript(inventedNorthStar, k2)}`,
);

log("\n=== Normalize helpers ===");
log(`normalize(90,90)=${normalizeToHundred(90, 90)}`);
log(`normalize(105,105)=${normalizeToHundred(105, 105)}`);

mkdirSync("qa-output", { recursive: true });
writeFileSync("qa-output/offline-audit.txt", out.join("\n"));
log("\nWrote qa-output/offline-audit.txt");
