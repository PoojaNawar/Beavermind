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
      <div className="bm-fade-up">
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] sm:text-[48px]">
          History
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          Completed and in-progress evaluations. Open a row to view the report.
        </p>
      </div>
      <div className="bm-fade-up bm-fade-up-delay-1 mt-8">
        <EvaluationHistory items={history} loadError={loadError} />
      </div>
    </div>
  );
}
