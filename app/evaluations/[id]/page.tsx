import Link from "next/link";
import { EvaluationPoller } from "@/components/EvaluationPoller";

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex text-sm font-medium text-[var(--accent)] hover:underline"
      >
        ← New evaluation
      </Link>
      <EvaluationPoller id={id} />
    </div>
  );
}
