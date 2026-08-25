import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Missing
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-[var(--muted)]">
        That evaluation does not exist. It may have been an invalid link.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline"
      >
        ← Back
      </Link>
    </div>
  );
}
