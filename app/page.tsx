import { EvaluationForm, type RubricSummary } from "@/components/EvaluationForm";
import { EvaluationHistory } from "@/components/EvaluationHistory";
import { listEvaluations } from "@/lib/db/evaluations";
import { getCoachingRubric } from "@/lib/rubrics/coaching";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";
import type { Rubric } from "@/lib/rubrics/types";

export const dynamic = "force-dynamic";

function toSummary(rubric: Rubric): RubricSummary {
  return {
    id: rubric.id,
    name: rubric.name,
    version: rubric.version,
    dimensionCount: rubric.dimensions.length,
    totalPoints: rubric.totalPoints,
  };
}

export default async function HomePage() {
  const rubrics = {
    kickoff: toSummary(getKickoffRubric()),
    coaching: toSummary(getCoachingRubric()),
  };

  let history = [] as Awaited<ReturnType<typeof listEvaluations>>;
  let loadError = false;
  try {
    history = await listEvaluations();
  } catch {
    loadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-16">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          New Evaluation
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
          Evaluate each conversation against its rubric with clear, evidence-backed
          feedback.
        </p>
        <div className="mt-10">
          <EvaluationForm rubrics={rubrics} />
        </div>
      </div>
      <EvaluationHistory items={history} loadError={loadError} />
    </div>
  );
}
