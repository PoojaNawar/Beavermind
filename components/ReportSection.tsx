"use client";

import { useId, useState, type ReactNode } from "react";

export function ReportSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="border-t border-[var(--line)] pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {title}
          </p>
          {summary && !open ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--ink)]">
              {summary}
            </p>
          ) : null}
        </div>
        <span
          className="mt-0.5 shrink-0 text-[var(--muted)]"
          aria-hidden
        >
          <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
          >
            <path
              d="M4 6.5 8 10.5 12 6.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="mt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
