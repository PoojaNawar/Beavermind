import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { getKickoffRubric } from "../lib/rubrics/kickoff";
import { applyCapsAndBuildResult } from "../lib/scoring/calculate";
import { hydrateCompletedReport } from "../lib/scoring/hydrateReport";
import {
  applyReportPresentation,
  briefSections,
  scoreHeadline,
} from "../lib/ui/reportPresentation";
import type { EvaluationResult } from "../lib/rubrics/types";

const kickoff01 = readFileSync("transcripts/kickoff-01.txt", "utf8");
const rubric = getKickoffRubric();

const base = applyCapsAndBuildResult({
  model: {
    oneThing: {
      recommendation: "Strengthen program explanation.",
      impact: "Improve client understanding.",
      estimatedPointsGained: 1,
      scoreIfAppliedBasis: "d5",
    },
    brief: "Strong call.",
    redFlags: [],
    firedCapIds: [],
    notes: "",
    dimensions: rubric.dimensions.map((d) => ({
      id: d.id,
      score: d.id === "d1" ? 9 : d.maxScore,
      disabled: false,
      disabledReason: null,
      notApplicable: false,
      notApplicableReason: null,
      band: null,
      rationale:
        d.id === "d1"
          ? "Dana demonstrated thorough preparation by referencing specific intake details."
          : d.id === "d12"
            ? "Dana made multiple explicit commitments."
            : "Strong dimension.",
      evidence:
        d.id === "d12"
          ? [
              {
                quote:
                  "re we actually go — I'm assigning your diagnostics... You'll also get a short re",
                speaker: null,
                location: null,
                demonstrated: true,
                verificationStatus: "verified" as const,
              },
            ]
          : [],
      quickFix: d.id === "d1" ? "Surface preparation early." : "",
      notDemonstrated: false,
    })),
  },
  rubric,
  modelName: "test",
  transcript: kickoff01,
}) as EvaluationResult;

const report = applyReportPresentation(hydrateCompletedReport(base, kickoff01));

mkdirSync("qa-output", { recursive: true });
writeFileSync("qa-output/kickoff-01-hydrate.json", JSON.stringify(report, null, 2));

console.log("Overall:", report.overallScore, report.grade);
const brief = briefSections(report);
console.log("\nSUMMARY:", scoreHeadline(report));
console.log("WHAT WENT WELL:", brief.well);
console.log("WHAT HELD BACK:", brief.held);
console.log("ONE THING:", report.oneThing.recommendation);
for (const d of report.dimensions) {
  if (d.disabled || d.notApplicable) continue;
  console.log(
    `${d.id} ${d.score}/${d.maxScore}`,
    d.whyNotFullMarks ? `| gap: ${d.whyNotFullMarks.slice(0, 60)}...` : "| FULL",
  );
  if (d.id === "d12") {
    for (const ev of d.evidence) {
      console.log(`  [${ev.speaker ?? "?"}] ${ev.quote.slice(0, 90)}...`);
    }
  }
}
