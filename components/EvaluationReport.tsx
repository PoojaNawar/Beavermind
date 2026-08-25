"use client";

import type {
  EvaluationAudit,
  EvaluationResult,
  EvaluationStatus,
} from "@/lib/rubrics/types";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import { DimensionAccordion } from "./DimensionAccordion";
import { ProcessingProgress } from "./ProcessingProgress";
import { ScoreGauge, ScoreStrip } from "./ScoreGauge";

function callTypeLabel(callType: string) {
  return callType === "kickoff" ? "Kick-off call" : "Coaching call";
}

function recorded(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  return String(value);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) {
    return new Date(iso).toLocaleString();
  }
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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
  clientName,
  coachName,
  clientDetails,
  onRetry,
  retrying,
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
  clientName?: string | null;
  coachName?: string | null;
  clientDetails?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (
    status === "pending" ||
    status === "processing" ||
    (status === "completed" && !result)
  ) {
    return (
      <ProcessingProgress
        status={status}
        stage={stage}
        processingPath={audit.processingPath}
        evaluationId={id}
        clientName={clientName}
      />
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--card)] p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--danger)]">
          Failed
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Processing failed
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-[var(--ink)]">
          {errorMessage ?? "Evaluation could not be completed. Please retry."}
        </p>
        <p className="mt-6 font-mono text-xs text-[var(--muted)]">{id}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-6 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
  const capLine =
    report.firedCaps.length > 0
      ? report.firedCaps.map((c) => c.effect).join("; ")
      : null;

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Full analysis
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            {clientName?.trim() || callTypeLabel(report.callType)}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {coachName?.trim()
              ? `Coached by ${coachName.trim()}`
              : callTypeLabel(report.callType)}
            {clientDetails?.trim() ? ` · ${clientDetails.trim()}` : ""}
            {" · "}
            Rubric {recorded(rubricVersion)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--muted)]">
            evaluated {relativeTime(createdAt)}
          </p>
          <a
            href={`/api/evaluations/${id}/pdf`}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path
                d="M8 2.5v8M5 8.5 8 11.5 11 8.5M3 13.5h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </a>
        </div>
      </header>

      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-5">
          <p className="text-[26px] font-semibold leading-snug tracking-tight sm:text-[30px]">
            {report.oneThing.recommendation}
          </p>
          <p className="text-[15px] leading-relaxed text-[var(--muted)]">
            {report.brief}
          </p>
          {report.oneThing.impact && (
            <p className="text-sm leading-relaxed">{report.oneThing.impact}</p>
          )}
          {report.oneThing.scoreIfApplied !== null && (
            <p className="text-sm text-[var(--muted)]">
              If applied: {report.oneThing.scoreIfApplied}/100 —{" "}
              {report.oneThing.scoreIfAppliedBasis}
            </p>
          )}

          {capLine && (
            <div className="flex gap-3 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
              <span className="mt-0.5 shrink-0" aria-hidden>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                  <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.4 0-.7.3-.7.7v3.2c0 .4.3.7.7.7s.7-.3.7-.7V6.4c0-.4-.3-.7-.7-.7Zm0 6.1a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7Z" />
                </svg>
              </span>
              <p>
                <span className="font-semibold">Capped: </span>
                {capLine}
              </p>
            </div>
          )}

          {report.redFlags.length > 0 && (
            <ul className="space-y-3">
              {report.redFlags.map((flag, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-[var(--danger)]/15 bg-[var(--card)] px-4 py-3"
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
        </div>

        <aside className="flex flex-col items-center lg:sticky lg:top-8">
          <ScoreGauge score={report.overallScore} grade={report.grade} />
          <div className="mt-5 w-full max-w-[220px]">
            <ScoreStrip dimensions={report.dimensions} />
          </div>
          {report.scoreOutOf !== 100 && (
            <p className="mt-3 text-center text-[11px] leading-snug text-[var(--muted)]">
              Normalized from {report.scoreOutOf} available points
            </p>
          )}
          <dl className="mt-5 w-full space-y-1 text-center text-xs text-[var(--muted)]">
            <div>
              <dt className="inline">Verified quotes </dt>
              <dd className="inline tabular-nums text-[var(--ink)]">
                {report.evidenceQuality.verified}/{report.evidenceQuality.found}
              </dd>
            </div>
            {report.evidenceQuality.rejected > 0 && (
              <div>
                <dt className="inline">Rejected </dt>
                <dd className="inline tabular-nums">{report.evidenceQuality.rejected}</dd>
              </div>
            )}
            {report.evidenceQuality.notDemonstratedDimensions > 0 && (
              <div>
                <dt className="inline">Not demonstrated </dt>
                <dd className="inline tabular-nums">
                  {report.evidenceQuality.notDemonstratedDimensions}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </section>

      <section>
        <DimensionAccordion
          dimensions={report.dimensions}
          callType={report.callType}
        />
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        <p>
          Pipeline {recorded(audit.pipelineVersion)} · Path{" "}
          {recorded(audit.processingPath)} · Model {recorded(modelName)} ·
          Provider {recorded(audit.provider)}
        </p>
        <p className="mt-1 font-mono">{id}</p>
      </footer>
    </div>
  );
}
