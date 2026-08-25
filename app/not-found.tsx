import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8">
      <h1 className="font-display text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-[var(--muted)]">
        That evaluation does not exist. It may have been an invalid link.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex text-sm font-semibold text-[var(--accent)]"
      >
        ← Back to evaluator
      </Link>
    </div>
  );
}
