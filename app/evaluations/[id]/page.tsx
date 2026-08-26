import Link from "next/link";
import { EvaluationPoller } from "@/components/EvaluationPoller";

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
        <Link
          href="/"
          className="text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← New evaluation
        </Link>
        <Link
          href="/history"
          className="text-[var(--muted)] hover:text-[var(--ink)]"
        >
          History
        </Link>
      </nav>
      <EvaluationPoller id={id} />
    </div>
  );
}
