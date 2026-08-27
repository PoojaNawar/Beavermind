"use client";

import { useState } from "react";
import type {
  EvaluationAudit,
  EvaluationResult,
  EvaluationStatus,
} from "@/lib/rubrics/types";
import { hydrateEvaluationResult } from "@/lib/transcripts/evidenceQuality";
import {
  briefSections,
  dimensionOverview,
  scoringNotes,
  scoreHeadline,
} from "@/lib/ui/reportPresentation";
import { coachingPillars } from "@/lib/scoring/scoreIfApplied";
import { DimensionAccordion } from "./DimensionAccordion";
import { ProcessingProgress } from "./ProcessingProgress";
import { PillarStrip } from "./PillarStrip";
import { ReportSection } from "./ReportSection";
import { ScoreStrip } from "./ScoreGauge";

function callTypeLabel(callType: string) {
  return callType === "kickoff" ? "Kick-off Call" : "Coaching Call";
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

function gradeTone(grade: string): string {
  if (grade === "Fail" || grade === "At risk") return "var(--danger)";
  if (grade === "Inconsistent") return "var(--warn)";
  return "var(--good)";
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
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [focusDimId, setFocusDimId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);

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
  const notes = scoringNotes(report);
  const brief = briefSections(report);
  const headline = scoreHeadline(report);
  const quality = report.evidenceQuality;
  const pillars = coachingPillars(report);
  const overview = dimensionOverview(report);

  async function downloadPdf() {
    setPdfError(null);
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/pdf`);
      if (!res.ok) {
        let message = "PDF download failed. Please retry.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* ignore */
        }
        setPdfError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluation-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("PDF download failed. Please retry.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-10 sm:space-y-12">
      <header className="bm-fade-up flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Full analysis
          </p>
          <h1 className="font-display mt-2 text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[42px]">
            {clientName?.trim() || callTypeLabel(report.callType)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {coachName?.trim() ? `Coached by ${coachName.trim()} · ` : ""}
            {callTypeLabel(report.callType)}
            {" · "}
            {rubricVersion}
          </p>
          {clientDetails?.trim() ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {clientDetails.trim()}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--muted)]">
            Evaluated {relativeTime(createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ink)] disabled:opacity-50"
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
          {pdfBusy ? "Preparing PDF…" : "Download PDF"}
        </button>
      </header>

      {pdfError ? (
        <p className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {pdfError}
        </p>
      ) : null}

      <section className="bm-score-in border-b border-[var(--line)] pb-10">
        <p className="font-display text-[48px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]">
          {report.overallScore}
          <span className="text-[24px] font-medium text-[var(--muted)]">
            {" "}
            / 100
          </span>
        </p>
        <p
          className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: gradeTone(report.grade) }}
        >
          {report.grade}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Based on {report.scoreOutOf} applicable points
        </p>
        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Summary
        </h2>
        <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-[var(--ink)]">
          {headline}
        </p>
      </section>

      <section className="bm-fade-up bm-fade-up-delay-1 border-b border-[var(--line)] pb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          One Thing
        </h2>
        <p className="font-display mt-3 text-[26px] font-semibold leading-snug tracking-[-0.02em] sm:text-[30px]">
          {report.oneThing.recommendation}
        </p>
        {report.oneThing.impact ? (
          <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[var(--muted)]">
            {report.oneThing.impact}
          </p>
        ) : null}
        {report.oneThing.scoreIfApplied !== null ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm leading-relaxed text-[var(--ink)]">
              Potential score if this gap were fully addressed:{" "}
              <span className="font-semibold tabular-nums">
                {report.oneThing.scoreIfApplied}/100
              </span>
            </p>
            <p className="text-sm text-[var(--muted)]">
              {report.oneThing.scoreIfAppliedBasis ||
                "Illustrative projection based on the current dimension score."}
            </p>
          </div>
        ) : report.oneThing.scoreIfAppliedBasis ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            {report.oneThing.scoreIfAppliedBasis}
          </p>
        ) : null}
      </section>

      <section className="bm-fade-up bm-fade-up-delay-2 border-b border-[var(--line)] pb-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              What went well
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">{brief.well}</p>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              What held the score back
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">{brief.held}</p>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              What to do next
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">{brief.next}</p>
          </div>
        </div>
      </section>

      {pillars.length > 0 ? (
        <ReportSection
          title="Pillars"
          summary="Connection · Confidence · Continuity"
          defaultOpen={false}
        >
          <PillarStrip pillars={pillars} showHeading={false} />
        </ReportSection>
      ) : null}

      <section className="border-b border-[var(--line)] pb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Evidence quality
        </h2>
        <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight">
          {quality.verified} / {quality.found} verified
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {quality.rejected} rejected
          {` · ${quality.notDemonstratedDimensions} not demonstrated`}
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Verified evidence is grounded in the original transcript. Rejected or
          unverified evidence does not support scoring.
        </p>
      </section>

      <section className="border-b border-[var(--line)] pb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Red flags
        </h2>
        {report.redFlags.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {report.redFlags.map((flag, i) => (
              <li key={i} className="border-l-2 border-[var(--danger)] pl-4">
                <h3 className="font-semibold text-[var(--danger)]">
                  {flag.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
                  {flag.explanation}
                </p>
                {flag.evidence ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Evidence: “{flag.evidence}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] font-medium text-[var(--muted)]">
            None identified
          </p>
        )}
      </section>

      {notes.length > 0 ? (
        <ReportSection
          title="Scoring notes"
          summary={notes[0]}
          defaultOpen={false}
        >
          <ul className="space-y-2 text-sm leading-relaxed">
            {notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </ReportSection>
      ) : null}

      <section className="border-t border-[var(--line)] pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Dimensions
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {overview.total} evaluation dimensions
            </p>
            <p className="mt-0.5 text-sm text-[var(--ink)]">{overview.summary}</p>
          </div>
          <div className="w-full max-w-[280px] sm:w-[280px]">
            <ScoreStrip
              dimensions={report.dimensions}
              onSelect={(dimId) => {
                setFocusDimId(dimId);
                setFocusKey((k) => k + 1);
              }}
            />
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Click a bar to jump to that dimension
            </p>
          </div>
        </div>
        <DimensionAccordion
          dimensions={report.dimensions}
          callType={report.callType}
          firedResult={report}
          focusId={focusDimId}
          focusKey={focusKey}
        />
      </section>

      <footer className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        <p className="font-mono">{id}</p>
      </footer>
    </div>
  );
}
