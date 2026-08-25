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

function fallbackAction(
  status: EvaluationStatus,
  stage: EvaluationStage | null,
): string {
  if (status === "pending" && (stage === null || stage === "pending")) {
    return "Waiting to start";
  }
  switch (stage) {
    case "extracting_evidence":
      return "Extracting evidence from the transcript";
    case "aggregating_evidence":
      return "Combining quotes from every chunk";
    case "evaluating":
      return "Scoring the call against the rubric";
    case "validating":
      return "Checking quotes against the original transcript";
    case "scoring":
      return "Calculating the overall score";
    default:
      return "Working on this evaluation";
  }
}

export function ProcessingProgress({
  status,
  stage,
  processingPath,
  evaluationId,
  progressMessage,
}: {
  status: EvaluationStatus;
  stage: string | null;
  processingPath: EvaluationAudit["processingPath"];
  evaluationId: string;
  progressMessage?: string | null;
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
  const action =
    progressMessage?.trim() || fallbackAction(status, resolved);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8">
      <h2 className="font-display text-2xl font-semibold">Processing</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Stay on this page — most calls finish in under a minute.
      </p>
      <div className="mt-5 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Now
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] animate-pulse"
          />
          {action}
        </p>
      </div>
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
