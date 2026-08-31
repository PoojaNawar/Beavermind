import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { hydrateCompletedReport } from "../lib/scoring/hydrateReport";
import { applyReportPresentation, briefSections } from "../lib/ui/reportPresentation";
import { detectDeterministicCapIds } from "../lib/scoring/detectCaps";
import {
  kickoffHasPrepElite,
  kickoffHasDeepWhyElite,
  kickoffHasAgendaElite,
} from "../lib/scoring/eliteBar";
import type { EvaluationResult } from "../lib/rubrics/types";

const transcript = readFileSync("transcripts/kickoff-02.txt", "utf8");
const raw = JSON.parse(readFileSync("qa-output/kickoff-02.json", "utf8"));
const report = applyReportPresentation(
  hydrateCompletedReport(raw.result as EvaluationResult, transcript),
);
const brief = briefSections(report);

mkdirSync("qa-output", { recursive: true });
writeFileSync("qa-output/kickoff-02-hydrated.json", JSON.stringify(report, null, 2));

console.log("Score:", report.overallScore, report.grade);
console.log(
  "Caps:",
  report.firedCaps.map((c) => c.id).join(", ") || "(none in hydrated result)",
);
console.log(
  "Detectors: prep=",
  kickoffHasPrepElite(transcript),
  "deepWhy=",
  kickoffHasDeepWhyElite(transcript),
  "agenda=",
  kickoffHasAgendaElite(transcript),
);
console.log("Deterministic caps:", detectDeterministicCapIds("kickoff", transcript));
console.log("\nWHAT WENT WELL:", brief.well);
console.log("WHAT HELD BACK:", brief.held);
console.log("ONE THING:", report.oneThing.recommendation);
console.log("\nDimensions:");
for (const d of report.dimensions) {
  if (d.disabled || d.notApplicable || d.score === null) continue;
  const tag =
    d.score >= d.maxScore
      ? "FULL"
      : d.whyNotFullMarks
        ? "PARTIAL"
        : "PARTIAL";
  console.log(`  ${d.id} ${d.name}: ${d.score}/${d.maxScore} [${tag}]`);
  if (d.whyNotFullMarks) {
    console.log(`    Why not full: ${d.whyNotFullMarks}`);
  }
  if (d.id === "d12" && d.quickFix) {
    console.log(`    Quick fix: ${d.quickFix}`);
  }
}
