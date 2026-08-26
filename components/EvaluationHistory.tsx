"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EvaluationHistoryItem } from "@/lib/db/evaluations";
import {
  formatHistoryTimestamp,
  historyCallTypeLabel,
  historyDisplayName,
  historyEvaluationId,
  historyStatusLabel,
} from "@/lib/ui/history";

export function EvaluationHistory({
  items,
  loadError,
}: {
  items: EvaluationHistoryItem[];
  loadError?: boolean;
}) {
  const router = useRouter();

  if (loadError) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        Couldn’t load evaluations. Refresh the page to try again.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-5 py-8">
        <p className="text-[15px] font-medium tracking-tight">
          No evaluations yet
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Run a kick-off or coaching evaluation. When it starts, it appears here
          with client name, coach name, call type, and created time.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
        >
          New evaluation →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <th className="px-5 py-3 font-semibold">Client name</th>
            <th className="px-5 py-3 font-semibold">Coach name</th>
            <th className="px-5 py-3 font-semibold">Call type</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Created at</th>
            <th className="px-5 py-3 font-semibold">Evaluation ID</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              tabIndex={0}
              role="link"
              aria-label={`Open evaluation ${historyEvaluationId(item.id)}`}
              className="cursor-pointer border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--accent-soft)]"
              onClick={() => router.push(`/evaluations/${item.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/evaluations/${item.id}`);
                }
              }}
            >
              <td className="px-5 py-3.5 font-medium tracking-tight">
                {historyDisplayName(item.clientName)}
              </td>
              <td className="px-5 py-3.5 truncate">
                {historyDisplayName(item.coachName)}
              </td>
              <td className="px-5 py-3.5">{historyCallTypeLabel(item.callType)}</td>
              <td className="px-5 py-3.5">{historyStatusLabel(item.status)}</td>
              <td className="px-5 py-3.5 tabular-nums text-[var(--muted)]">
                {formatHistoryTimestamp(item.createdAt)}
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-[var(--muted)]">
                {historyEvaluationId(item.id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
