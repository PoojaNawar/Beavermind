import type { EvaluationAudit, EvaluationStatus } from "@/lib/rubrics/types";
import {
  PROCESSING_STEP_ORDER,
  stageFromLegacyStatus,
  type EvaluationStage,
} from "@/lib/pipeline/stages";

const STEP_LABELS: Record<(typeof PROCESSING_STEP_ORDER)[number], string> = {
  extracting_evidence: "Extracting evidence",
  aggregating_evidence: "Aggregating evidence",
  evaluating: "Evaluating rubric",
  validating: "Validating evidence",
  scoring: "Calculating score",
  completed: "Complete",
};

function stepIndex(stage: EvaluationStage | null): number {
  if (!stage) return -1;
  return (PROCESSING_STEP_ORDER as readonly string[]).indexOf(stage);
}

export function ProcessingProgress({
  status,
  stage,
  processingPath,
  evaluationId,
}: {
  status: EvaluationStatus;
  stage: string | null;
  processingPath: EvaluationAudit["processingPath"];
  evaluationId: string;
}) {
  const resolved = stageFromLegacyStatus(status, stage);
  const currentIdx = stepIndex(resolved);
  const skipExtract =
    processingPath === "single" ||
    (processingPath !== "chunked" &&
      resolved !== null &&
      resolved !== "pending" &&
      resolved !== "extracting_evidence" &&
      resolved !== "aggregating_evidence");

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8">
      <h2 className="font-display text-2xl font-semibold">Processing</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        You can close this tab — the evaluation keeps running. This page
        updates from the saved pipeline stage.
      </p>
      <ol className="mt-6 space-y-2">
        {PROCESSING_STEP_ORDER.map((step, i) => {
          if (
            skipExtract &&
            (step === "extracting_evidence" || step === "aggregating_evidence")
          ) {
            return (
              <li key={step} className="flex gap-3 text-sm text-[var(--muted)]">
                <span className="w-4 tabular-nums">○</span>
                <span>{STEP_LABELS[step]} — skipped (single-pass)</span>
              </li>
            );
          }

          let marker = "○";
          if (resolved === "pending" && i === 0) marker = "→";
          if (currentIdx > i) marker = "✓";
          if (currentIdx === i) marker = "→";
          if (step === "completed" && resolved !== "completed") marker = "○";

          return (
            <li
              key={step}
              className={`flex gap-3 text-sm ${
                marker === "→"
                  ? "font-medium text-[var(--ink)]"
                  : marker === "✓"
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <span className="w-4 tabular-nums">{marker}</span>
              <span>{STEP_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>
      {resolved === null && status === "processing" && (
        <p className="mt-4 text-sm text-[var(--muted)]">Stage: Not recorded</p>
      )}
      <p className="mt-6 font-mono text-xs text-[var(--muted)]">
        Evaluation ID: {evaluationId}
      </p>
    </div>
  );
}
