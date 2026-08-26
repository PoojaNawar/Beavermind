import { EvaluationHistory } from "@/components/EvaluationHistory";
import { listEvaluations } from "@/lib/db/evaluations";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let history = [] as Awaited<ReturnType<typeof listEvaluations>>;
  let loadError = false;
  try {
    history = await listEvaluations();
  } catch {
    loadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        History
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
        Completed and in-progress evaluations. Open a row to view the report.
      </p>
      <EvaluationHistory items={history} loadError={loadError} />
    </div>
  );
}
