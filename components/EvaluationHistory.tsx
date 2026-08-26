"use client";

import Link from "next/link";
import type { EvaluationHistoryItem } from "@/lib/db/evaluations";
import {
  formatHistoryTimestamp,
  historyCallTypeLabel,
  historyDisplayName,
} from "@/lib/ui/history";

function statusLabel(status: EvaluationHistoryItem["status"]): string | null {
  if (status === "completed") return null;
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing";
  return "Queued";
}

export function EvaluationHistory({
  items,
  loadError,
}: {
  items: EvaluationHistoryItem[];
  loadError?: boolean;
}) {
  return (
    <section id="history" className="scroll-mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        History
      </h2>

      {loadError ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Couldn’t load past evaluations. Refresh the page to try again.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No evaluations yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const status = statusLabel(item.status);
            return (
              <li key={item.id}>
                <Link
                  href={`/evaluations/${item.id}`}
                  className="block rounded-2xl border border-[var(--line)] bg-[var(--card)] px-5 py-4 transition hover:border-[var(--ink)]/20 hover:bg-[var(--accent-soft)]"
                >
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                    <div className="min-w-0">
                      <dt className="text-[var(--muted)]">Client</dt>
                      <dd className="mt-0.5 truncate font-medium">
                        {historyDisplayName(item.clientName)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--muted)]">Coach</dt>
                      <dd className="mt-0.5 truncate font-medium">
                        {historyDisplayName(item.coachName)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--muted)]">Call</dt>
                      <dd className="mt-0.5 font-medium">
                        {historyCallTypeLabel(item.callType)}
                        {status ? (
                          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                            {status}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[var(--muted)]">When</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatHistoryTimestamp(item.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
