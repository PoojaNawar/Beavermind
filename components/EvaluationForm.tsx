"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_MAX_TRANSCRIPT_CHARS } from "@/lib/transcripts/thresholds";
import type { CallType } from "@/lib/rubrics/types";

const MAX_CHARS = DEFAULT_MAX_TRANSCRIPT_CHARS;

export interface RubricSummary {
  id: CallType;
  name: string;
  version: string;
  dimensionCount: number;
  totalPoints: number;
}

const CALL_BLURBS: Record<CallType, string> = {
  kickoff:
    "Onboarding, rapport, goals, expectations, and first-week plan.",
  coaching:
    "Connection, diagnostics, coaching intelligence, and next-step action.",
};

const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[15px] outline-none placeholder:text-[var(--muted)]/55 focus:border-[var(--ink)]";

function displayOrDash(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : "—";
}

export function EvaluationForm({
  rubrics,
}: {
  rubrics: Record<CallType, RubricSummary>;
}) {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [clientName, setClientName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [clientDetails, setClientDetails] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const rubric = rubrics[callType];
  const charCount = transcript.length;
  const overLimit = charCount > MAX_CHARS;
  const empty = transcript.trim().length === 0;
  const canSubmit = Boolean(clientName.trim()) && !empty && !overLimit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientName.trim()) {
      setError("Add the client’s name before evaluating.");
      return;
    }
    if (empty) {
      setError("Paste or upload a transcript before evaluating.");
      return;
    }
    if (overLimit) {
      setError(`Transcript is too large (max ${MAX_CHARS.toLocaleString()} characters).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callType,
          transcript,
          clientName: clientName.trim(),
          coachName: coachName.trim(),
          clientDetails: clientDetails.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start evaluation.");
        setSubmitting(false);
        return;
      }
      startTransition(() => {
        router.push(`/evaluations/${data.id}`);
      });
    } catch {
      setError("Network error while creating the evaluation.");
      setSubmitting(false);
    }
  }

  const busy = submitting || isPending;
  const callTypes = useMemo(
    () => [rubrics.kickoff, rubrics.coaching] as const,
    [rubrics],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-12">
      <section className="space-y-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Evaluation setup
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="clientName"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              Client
            </label>
            <input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              disabled={busy}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="coachName"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              Coach
            </label>
            <input
              id="coachName"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="Coach name"
              disabled={busy}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="clientDetails"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]"
          >
            Context / Details
          </label>
          <input
            id="clientDetails"
            value={clientDetails}
            onChange={(e) => setClientDetails(e.target.value)}
            placeholder="Optional — cohort, week, or notes"
            disabled={busy}
            className={inputClass}
          />
        </div>

        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Call type
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {callTypes.map((opt) => {
              const active = callType === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`cursor-pointer rounded-xl border bg-[var(--card)] px-4 py-4 ${
                    active
                      ? "border-[var(--ink)]"
                      : "border-[var(--line)] hover:border-[var(--ink)]/35"
                  }`}
                >
                  <input
                    type="radio"
                    name="callType"
                    value={opt.id}
                    checked={active}
                    onChange={() => setCallType(opt.id)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold tracking-tight">
                      {opt.name}
                    </span>
                    <span
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                        active
                          ? "border-[var(--ink)] bg-[var(--ink)]"
                          : "border-[var(--line)]"
                      }`}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                    {CALL_BLURBS[opt.id]}
                  </p>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Rubric
          </p>
          <p className="mt-2 text-[15px] font-medium tracking-tight">
            {rubric.name} · {rubric.version}
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {rubric.dimensionCount} dimensions · {rubric.totalPoints} points
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Call transcript
          </h2>
          <span
            className={`text-[11px] tabular-nums text-[var(--muted)] ${
              overLimit ? "text-[var(--danger)]" : ""
            }`}
          >
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={16}
          placeholder="Paste the call transcript here…"
          className="min-h-[280px] w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-4 font-mono text-[13px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted)]/55 focus:border-[var(--ink)]"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="cursor-pointer text-sm font-medium text-[var(--ink)] underline-offset-4 hover:underline">
            Paste transcript or upload a file
            <input
              type="file"
              accept=".txt,.md,.text,text/plain"
              className="sr-only"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const text = await file.text();
                if (/[\u0000-\u0008]/.test(text)) {
                  setError("That file does not look like a text transcript.");
                  return;
                }
                setTranscript(text);
                setError(null);
              }}
            />
          </label>
          <p className="text-xs text-[var(--muted)]">.txt or .md</p>
        </div>
        {overLimit && (
          <p className="text-sm text-[var(--danger)]">
            Transcript exceeds the maximum length.
          </p>
        )}
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Evaluation summary
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Client</dt>
            <dd className="font-medium sm:mt-0.5">{displayOrDash(clientName)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Coach</dt>
            <dd className="font-medium sm:mt-0.5">{displayOrDash(coachName)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Call</dt>
            <dd className="font-medium sm:mt-0.5">{rubric.name}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Rubric</dt>
            <dd className="font-medium sm:mt-0.5">{rubric.version}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Dimensions</dt>
            <dd className="font-medium sm:mt-0.5">{rubric.dimensionCount}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[var(--muted)]">Maximum score</dt>
            <dd className="font-medium sm:mt-0.5">{rubric.totalPoints}</dd>
          </div>
        </dl>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {busy ? "Starting…" : "Run evaluation →"}
        </button>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Overall score · dimension scores · verified evidence · red flags ·
          quick fixes
        </p>
      </div>
    </form>
  );
}
