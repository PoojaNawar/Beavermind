import { EvaluationForm } from "@/components/EvaluationForm";

export default function HomePage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
      <section className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          BeaverMind
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Call Quality Evaluation
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-[var(--muted)]">
          Score kick-off and coaching calls with a rubric and quotes from the
          transcript.
        </p>
        <p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">
          Paste a transcript or upload a transcript file. BeaverMind scores the
          conversation against the selected rubric.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)]/90 p-5 sm:p-7">
        <h2 className="font-display text-2xl font-semibold">New evaluation</h2>
        <p className="mt-1 mb-6 text-sm text-[var(--muted)]">
          Choose the call type, then paste or upload the transcript.
        </p>
        <EvaluationForm />
      </section>
    </div>
  );
}
