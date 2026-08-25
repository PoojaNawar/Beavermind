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

function stepIndex(
  stage: EvaluationStage | null,
  steps: readonly string[],
): number {
  if (!stage) return -1;
  return steps.indexOf(stage);
}

export function ProcessingProgress({
  status,
  stage,
  processingPath,
  evaluationId,
  clientName,
}: {
  status: EvaluationStatus;
  stage: string | null;
  processingPath: EvaluationAudit["processingPath"];
  evaluationId: string;
  clientName?: string | null;
}) {
  const resolved = stageFromLegacyStatus(status, stage);
  const chunked = processingPath === "chunked";
  const steps = chunked
    ? PROCESSING_STEP_ORDER
    : PROCESSING_STEP_ORDER.filter(
        (step) =>
          step !== "extracting_evidence" && step !== "aggregating_evidence",
      );

  let displayStage = resolved;
  if (
    !chunked &&
    (resolved === "pending" ||
      resolved === "extracting_evidence" ||
      resolved === "aggregating_evidence")
  ) {
    displayStage = "evaluating";
  }

  const currentIdx = stepIndex(displayStage, steps);

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Evaluation
      </p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">
        {clientName?.trim() ? clientName.trim() : "Processing"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Scoring this call against the rubric. You can close the tab — reopen
        this URL for the report.
      </p>
      <ol className="mt-8 space-y-3">
        {steps.map((step, i) => {
          let state: "done" | "now" | "wait" = "wait";
          if (currentIdx > i) state = "done";
          if (currentIdx === i) state = "now";
          if (step === "completed" && displayStage !== "completed") state = "wait";

          return (
            <li
              key={step}
              className={`flex items-center gap-3 text-sm ${
                state === "now"
                  ? "font-semibold text-[var(--ink)]"
                  : state === "done"
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  state === "now"
                    ? "bg-[var(--ink)]"
                    : state === "done"
                      ? "bg-[var(--good)]"
                      : "bg-[var(--line)]"
                }`}
              />
              <span>{STEP_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>
      {resolved === null && status === "processing" && (
        <p className="mt-4 text-sm text-[var(--muted)]">Stage: Not recorded</p>
      )}
      <p className="mt-8 font-mono text-xs text-[var(--muted)]">{evaluationId}</p>
    </div>
  );
}
