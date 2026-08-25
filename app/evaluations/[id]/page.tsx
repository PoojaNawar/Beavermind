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
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← Back
      </Link>
      <EvaluationPoller id={id} />
    </div>
  );
}
