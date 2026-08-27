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
    "How well did the coach understand the client, set expectations, and establish clear next steps?",
  coaching:
    "How well did the coach explore the problem, ask useful questions, and help the client move forward?",
};

const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[15px] outline-none transition placeholder:text-[var(--muted)]/55 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]";

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
    <form onSubmit={onSubmit} className="space-y-10">
      <section className="space-y-5">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Call details
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add a little context so we can evaluate the conversation correctly.
          </p>
        </div>

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
              placeholder="Who was the client?"
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
              placeholder="Who led the conversation?"
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
            Context
          </label>
          <input
            id="clientDetails"
            value={clientDetails}
            onChange={(e) => setClientDetails(e.target.value)}
            placeholder="Optional — add anything that could help us interpret the conversation."
            disabled={busy}
            className={inputClass}
          />
        </div>

        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Conversation type
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {callTypes.map((opt) => {
              const active = callType === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`cursor-pointer rounded-xl border bg-[var(--card)] px-4 py-4 transition ${
                    active
                      ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                      : "border-[var(--line)] hover:border-[var(--accent)]/40"
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
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--line)]"
                      }`}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                    {CALL_BLURBS[opt.id]}
                  </p>
                  {active ? (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {opt.version} · {opt.dimensionCount} dimensions ·{" "}
                      {opt.totalPoints} points
                    </p>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Call transcript
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Paste the transcript below or upload a .txt or .md file.
            </p>
          </div>
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
          rows={14}
          placeholder="Paste the conversation here…"
          className="min-h-[260px] w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-4 font-mono text-[13px] leading-relaxed text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)]/55 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="cursor-pointer text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline">
            Upload .txt or .md
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
        </div>
        {overLimit && (
          <p className="text-sm text-[var(--danger)]">
            Transcript exceeds the maximum length.
          </p>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          {displayOrDash(clientName)}
          {" · "}
          {rubric.name}
          {" · "}
          {rubric.version}
        </p>
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {busy ? "Starting…" : "Run evaluation"}
        </button>
      </div>
    </form>
  );
}
