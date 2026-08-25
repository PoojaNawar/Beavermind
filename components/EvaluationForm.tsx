"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_MAX_TRANSCRIPT_CHARS,
  DEFAULT_SINGLE_PASS_CHARS,
} from "@/lib/transcripts/thresholds";

const MAX_CHARS = DEFAULT_MAX_TRANSCRIPT_CHARS;

type CallType = "kickoff" | "coaching";

export function EvaluationForm() {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const charCount = transcript.length;
  const overLimit = charCount > MAX_CHARS;
  const empty = transcript.trim().length === 0;

  const helper = useMemo(() => {
    if (overLimit) return "Transcript exceeds the maximum length.";
    if (charCount > DEFAULT_SINGLE_PASS_CHARS)
      return `Long transcript (>${DEFAULT_SINGLE_PASS_CHARS.toLocaleString()} chars) — chunked evidence extraction, then synthesis.`;
    return "Paste a transcript or upload a transcript file. BeaverMind evaluates the conversation against the selected rubric.";
  }, [charCount, overLimit]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
        body: JSON.stringify({ callType, transcript }),
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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--ink)]">
          1. Choose call type
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                id: "kickoff" as const,
                title: "Kick-off Call",
                blurb: "12 dimensions · onboarding & North Star",
              },
              {
                id: "coaching" as const,
                title: "Coaching Call",
                blurb: "12 dimensions · connection, confidence, continuity",
              },
            ] as const
          ).map((opt) => {
            const active = callType === opt.id;
            return (
              <label
                key={opt.id}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm"
                    : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--accent)]/40"
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
                <div className="font-semibold">{opt.title}</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  {opt.blurb}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="transcript"
            className="text-sm font-semibold text-[var(--ink)]"
          >
            2. Provide transcript
          </label>
          <span
            className={`text-xs tabular-nums ${
              overLimit ? "text-[var(--danger)]" : "text-[var(--muted)]"
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
          placeholder={`[Dana Whitlock]: Hey, is this Owen?\n[Owen Brandt]: Yeah, hey, that's me...`}
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 font-mono text-sm leading-relaxed text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)]/60 focus:ring-2"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer text-sm font-medium text-[var(--accent)] hover:underline">
            Upload transcript
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
          <span className="text-xs text-[var(--muted)]">.txt or .md</span>
        </div>
        <p className="text-sm text-[var(--muted)]">{helper}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || empty || overLimit}
        className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting evaluation…" : "Evaluate call"}
      </button>
    </form>
  );
}
