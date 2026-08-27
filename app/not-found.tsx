import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bm-fade-up mx-auto max-w-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Missing
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-[-0.02em]">
        Not found
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        That evaluation does not exist. It may have been an invalid link.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
      >
        ← Back to evaluate
      </Link>
    </div>
  );
}
