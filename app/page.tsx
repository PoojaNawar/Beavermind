import { EvaluationForm, type RubricSummary } from "@/components/EvaluationForm";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { Rubric } from "@/lib/rubrics/types";

function toSummary(rubric: Rubric): RubricSummary {
  return {
    id: rubric.id,
    name: rubric.name,
    version: rubric.version,
    dimensionCount: rubric.dimensions.length,
    totalPoints: rubric.totalPoints,
  };
}

export default function HomePage() {
  const rubrics = {
    kickoff: toSummary(getKickoffRubric()),
    coaching: toSummary(getCoachingRubric()),
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="bm-fade-up">
        <p className="font-display text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--ink)] sm:text-[52px]">
          BeaverMind
        </p>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-[var(--ink)] sm:text-[26px]">
          Judge the call with evidence.
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[var(--muted)]">
          Paste a kick-off or coaching transcript. Get a rubric score, verified
          evidence, and one clear improvement.
        </p>
      </div>
      <div className="bm-fade-up bm-fade-up-delay-1 mt-10">
        <EvaluationForm rubrics={rubrics} />
      </div>
    </div>
  );
}
