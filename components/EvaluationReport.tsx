"use client";

import type {
  EvaluationAudit,
  EvaluationResult,
  EvaluationStatus,
} from "@/lib/rubrics/types";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import { DimensionAccordion } from "./DimensionAccordion";
import { ProcessingProgress } from "./ProcessingProgress";

function callTypeLabel(callType: string) {
  return callType === "kickoff" ? "Kick-off Call" : "Coaching Call";
}

function gradeColor(grade: string) {
  switch (grade) {
    case "Elite":
      return "text-[var(--accent)]";
    case "Strong":
      return "text-[var(--ink)]";
    case "Inconsistent":
      return "text-[var(--warn)]";
    case "At risk":
    case "Fail":
      return "text-[var(--danger)]";
    default:
      return "text-[var(--ink)]";
  }
}

function recorded(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  return String(value);
}

export function EvaluationReport({
  id,
  status,
  stage,
  errorMessage,
  result,
  createdAt,
  rubricVersion,
  audit,
  modelName,
  onRetry,
  retrying,
  progressMessage,
}: {
  id: string;
  status: EvaluationStatus;
  stage: string | null;
  errorMessage: string | null;
  result: EvaluationResult | null;
  createdAt: string;
  rubricVersion: string;
  audit: EvaluationAudit;
  modelName: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  progressMessage?: string | null;
}) {
  if (status === "pending" || status === "processing") {
    return (
      <ProcessingProgress
        status={status}
        stage={stage}
        processingPath={audit.processingPath}
        evaluationId={id}
        progressMessage={progressMessage}
      />
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-8">
        <h2 className="font-display text-2xl font-semibold text-[var(--danger)]">
          Processing failed
        </h2>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Reason
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
          {errorMessage ?? "Evaluation could not be completed. Please retry."}
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Evaluation ID
        </p>
        <p className="mt-1 font-mono text-sm text-[var(--ink)]">{id}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-6 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Retry evaluation"}
          </button>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8">
        <p className="text-[var(--muted)]">No result payload available.</p>
      </div>
    );
  }

  const report = hydrateEvaluationResult(result);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">BeaverMind</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Call Quality Evaluation
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {callTypeLabel(report.callType)} · {recorded(rubricVersion)}
          </p>
        </div>
        <a
          href={`/api/evaluations/${id}/pdf`}
          className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Download PDF
        </a>
      </div>

      <section className="border-b border-[var(--line)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Final score
        </p>
        <p className="mt-1 font-display text-5xl font-semibold tabular-nums">
          {report.overallScore}
          <span className="text-2xl font-medium text-[var(--muted)]"> / 100</span>
        </p>
        <p className={`mt-2 text-xl font-semibold ${gradeColor(report.grade)}`}>
          {report.grade}
        </p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          One Thing
        </h2>
        <p className="mt-2 text-lg font-semibold leading-snug">
          {report.oneThing.recommendation}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">{report.oneThing.impact}</p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Brief
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed">{report.brief}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Red flags</h2>
        {report.redFlags.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No red flags identified from transcript evidence.
          </p>
        ) : (
          <ul className="space-y-3">
            {report.redFlags.map((flag, i) => (
              <li
                key={i}
                className="border-l-2 border-[var(--danger)]/40 pl-4"
              >
                <h3 className="font-semibold text-[var(--danger)]">
                  {flag.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed">{flag.explanation}</p>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                  {flag.evidence}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Evidence quality
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">Found</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {report.evidenceQuality.found}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Verified</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {report.evidenceQuality.verified}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Rejected</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {report.evidenceQuality.rejected}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Not demonstrated</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {report.evidenceQuality.notDemonstratedDimensions}
              <span className="ml-1 text-sm font-normal text-[var(--muted)]">
                dimensions
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {report.firedCaps.length > 0 && (
        <p className="text-sm text-[var(--warn)]">
          <strong>Caps applied:</strong>{" "}
          {report.firedCaps.map((c) => c.effect).join("; ")}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          Twelve dimensions
        </h2>
        <DimensionAccordion dimensions={report.dimensions} />
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        <p>
          Pipeline {recorded(audit.pipelineVersion)} · Path{" "}
          {recorded(audit.processingPath)} · Model {recorded(modelName)} ·
          Provider {recorded(audit.provider)}
        </p>
        <p className="mt-1">
          {new Date(createdAt).toLocaleString()} · ID {id}
        </p>
      </footer>
    </div>
  );
}
