"use client";

import { useEffect, useState } from "react";
import type { EvaluationAudit, EvaluationStatus } from "@/lib/rubrics/types";
import {
  PROCESSING_STEP_ORDER,
  stageFromLegacyStatus,
  type EvaluationStage,
} from "@/lib/pipeline/stages";

const STEP_LABELS: Record<(typeof PROCESSING_STEP_ORDER)[number], string> = {
  extracting_evidence: "Extracting evidence from the transcript",
  aggregating_evidence: "Combining evidence across the call",
  evaluating: "Evaluating against the rubric",
  validating: "Checking evidence against the transcript",
  scoring: "Calculating the final score",
  completed: "Complete",
};

const STEP_HINTS: Partial<
  Record<(typeof PROCESSING_STEP_ORDER)[number], string>
> = {
  evaluating: "This is usually the longest step.",
  validating: "Longer transcripts can take about a minute here.",
  scoring: "Almost done — totals and grade come next.",
};

function stepIndex(
  stage: EvaluationStage | null,
  steps: readonly string[],
): number {
  if (!stage) return -1;
  return steps.indexOf(stage);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
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
  const currentStep =
    currentIdx >= 0
      ? (steps[currentIdx] as (typeof PROCESSING_STEP_ORDER)[number])
      : null;
  const inProgress = status === "pending" || status === "processing";

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!inProgress) return;
    setElapsedSec(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [inProgress, evaluationId]);

  const activeLabel = currentStep ? STEP_LABELS[currentStep] : "Starting";
  const activeHint =
    currentStep && STEP_HINTS[currentStep] ? STEP_HINTS[currentStep] : null;

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Evaluation
      </p>
      <h2 className="font-display mt-2 text-4xl font-semibold tracking-[-0.02em]">
        {clientName?.trim() ? clientName.trim() : "Processing"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Scoring this conversation against the rubric. Steps advance when each
        part of the evaluation finishes — they are not timed equally. You can
        close this tab and reopen the URL for the report.
      </p>

      {inProgress ? (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--ink)]">
            Working · {formatElapsed(elapsedSec)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{activeLabel}</p>
          {activeHint ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {activeHint}
            </p>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-8 space-y-3.5">
        {steps.map((step, i) => {
          let state: "done" | "now" | "wait" = "wait";
          if (currentIdx > i) state = "done";
          if (currentIdx === i) state = "now";
          if (step === "completed" && displayStage !== "completed") {
            state = "wait";
          }

          return (
            <li
              key={step}
              className={`flex items-start gap-3 text-sm ${
                state === "now"
                  ? "font-semibold text-[var(--ink)]"
                  : state === "done"
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <span className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                {state === "now" ? (
                  <span className="bm-pulse-dot relative flex h-2.5 w-2.5">
                    <span className="bm-pulse-ring absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                  </span>
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      state === "done" ? "bg-[var(--good)]" : "bg-[var(--line)]"
                    }`}
                  />
                )}
              </span>
              <span className="min-w-0 leading-snug">
                {STEP_LABELS[step]}
                {state === "now" ? (
                  <span className="mt-0.5 block text-xs font-medium text-[var(--muted)]">
                    In progress
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {resolved === null && status === "processing" ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Stage details are still catching up.
        </p>
      ) : null}

      <p className="mt-8 font-mono text-xs text-[var(--muted)]">{evaluationId}</p>
    </div>
  );
}
