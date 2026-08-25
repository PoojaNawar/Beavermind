import type { EvaluationAudit, EvaluationStatus } from "@/lib/rubrics/types";

export function ProcessingProgress({
  evaluationId,
}: {
  status: EvaluationStatus;
  stage: string | null;
  processingPath: EvaluationAudit["processingPath"];
  evaluationId: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8">
      <h2 className="font-display text-2xl font-semibold">Processing</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        You can close this tab — the evaluation keeps running. Come back to
        this URL for the report.
      </p>
      <p className="mt-6 font-mono text-xs text-[var(--muted)]">
        Evaluation ID: {evaluationId}
      </p>
    </div>
  );
}
