"use client";

import { useEffect, useState } from "react";
import type { DimensionResult, EvidenceItem } from "@/lib/rubrics/types";
import {
  dimensionEvidenceUi,
  isUnverifiedEvidence,
  isVerifiedEvidence,
} from "@/lib/transcripts/evidenceQuality";
import {
  dimensionTone,
  isHighWeightDimension,
  scorePillClass,
  scoredRationale,
  toneFill,
} from "@/lib/ui/scoreTone";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";

function QuickFixBlock({
  dim,
  callType,
}: {
  dim: DimensionResult;
  callType: string;
}) {
  const quickFix = presentQuickFix(dim, callType);
  if (!quickFix) return null;

  return (
    <section className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Quick fix
      </h4>
      <p
        className={`mt-1.5 text-sm font-semibold tracking-tight ${
          quickFix.complete ? "text-[var(--muted)]" : "text-[var(--ink)]"
        }`}
      >
        {quickFix.title}
      </p>
      {quickFix.body ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
          {quickFix.body}
        </p>
      ) : null}
      {quickFix.steps && quickFix.steps.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--ink)]">
          {quickFix.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function evidenceItemLabel(ev: EvidenceItem): string {
  if (ev.verificationStatus === "verified") return "Verified";
  if (ev.verificationStatus === "unverified") return "Unverified";
  return "Not demonstrated";
}

function Star() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 text-[var(--gold)]"
      fill="currentColor"
      aria-label="High-weight dimension"
    >
      <path d="M8 1.15 9.76 5.3l4.54.5-3.4 2.95.95 4.47L8 11.2l-3.85 2.02.95-4.47-3.4-2.95 4.54-.5L8 1.15Z" />
    </svg>
  );
}

function DimensionRail({
  dimensions,
  callType,
  activeId,
  onJump,
}: {
  dimensions: DimensionResult[];
  callType: string;
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  const label = callType === "kickoff" ? "Kick-off" : "Coaching";

  return (
    <nav
      className="sticky top-24 hidden w-12 shrink-0 flex-col items-center lg:flex"
      aria-label="Jump to dimension"
    >
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] [writing-mode:vertical-rl] rotate-180">
        {label}
      </p>
      <ol className="relative flex flex-col items-center gap-2.5">
        <span
          className="absolute top-1 bottom-1 w-px bg-[var(--line)]"
          aria-hidden
        />
        {dimensions.map((dim, i) => {
          const active = activeId === dim.id;
          return (
            <li key={dim.id} className="relative z-[1]">
              <button
                type="button"
                onClick={() => onJump(dim.id)}
                title={`${i + 1}. ${dim.name}`}
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-[var(--bg)] transition ${
                  active
                    ? "scale-125 border-[var(--ink)]"
                    : "border-transparent"
                }`}
              >
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: toneFill(dimensionTone(dim)) }}
                />
                <span className="sr-only">
                  {i + 1}. {dim.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DimensionAccordion({
  dimensions,
  callType,
}: {
  dimensions: DimensionResult[];
  callType: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(
    dimensions[0]?.id ?? null,
  );

  useEffect(() => {
    const nodes = dimensions
      .map((d) => document.getElementById(`dim-${d.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (nodes.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id.startsWith("dim-")) {
          setActiveId(visible.target.id.slice(4));
        }
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [dimensions]);

  function jump(id: string) {
    document.getElementById(`dim-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveId(id);
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_3rem] lg:gap-6">
      <div className="space-y-8">
        {dimensions.map((dim, index) => {
          const scoreLabel = dim.disabled
            ? "Off"
            : dim.notApplicable
              ? "N/A"
              : `${dim.score}/${dim.maxScore}`;
          const evidenceUi = dimensionEvidenceUi(dim);
          const verifiedItems = dim.evidence.filter(isVerifiedEvidence);
          const unverifiedItems = dim.evidence.filter(isUnverifiedEvidence);
          const ndItems = dim.evidence.filter(
            (e) => e.verificationStatus === "not_demonstrated",
          );
          const hasEvidence =
            verifiedItems.length + unverifiedItems.length + ndItems.length > 0;

          return (
            <article
              key={dim.id}
              id={`dim-${dim.id}`}
              className="scroll-mt-8"
            >
              <header className="flex items-start justify-between gap-4">
                <h3 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold tracking-tight">
                  <span className="text-[var(--muted)]">{index + 1}</span>
                  <span>{dim.name}</span>
                  {isHighWeightDimension(dim) && <Star />}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${scorePillClass(dimensionTone(dim))}`}
                >
                  {scoreLabel}
                </span>
              </header>

              {dim.disabledReason && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {dim.disabledReason}
                </p>
              )}
              {dim.notApplicableReason && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {dim.notApplicableReason}
                </p>
              )}

              <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink)]">
                {scoredRationale(dim)}
              </p>

              {!dim.disabled && !dim.notApplicable && (
                <p
                  className={`mt-2 text-xs ${
                    evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
                      ? "text-[#8a6a12]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {evidenceUi.label}
                  {evidenceUi.explanation ? ` — ${evidenceUi.explanation}` : ""}
                </p>
              )}

              <section className="mt-5">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Evidence
                </h4>
                {!hasEvidence ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    No transcript evidence attached.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2.5">
                    {verifiedItems.map((ev, i) => (
                      <li key={`v-${i}`} className="text-[14px] leading-relaxed">
                        <span className="font-medium text-[var(--ink)]">
                          {ev.speaker ?? "Speaker"}:{" "}
                        </span>
                        <span className="text-[var(--ink)]">“{ev.quote}”</span>
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--good)]">
                          {evidenceItemLabel(ev)}
                        </span>
                        {ev.location ? (
                          <span className="ml-1 text-xs text-[var(--muted)]">
                            · {ev.location}
                          </span>
                        ) : null}
                      </li>
                    ))}
                    {ndItems.map((ev, i) => (
                      <li
                        key={`nd-${i}`}
                        className="text-sm leading-relaxed text-[var(--muted)]"
                      >
                        {ev.quote}
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide">
                          {evidenceItemLabel(ev)}
                        </span>
                      </li>
                    ))}
                    {unverifiedItems.map((ev, i) => (
                      <li
                        key={`u-${i}`}
                        className="text-[14px] leading-relaxed text-[#8a6a12]"
                      >
                        <span className="font-medium">
                          {ev.speaker ?? "Speaker"}:{" "}
                        </span>
                        “{ev.quote}”
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide">
                          Unverified — not in transcript
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <QuickFixBlock dim={dim} callType={callType} />
            </article>
          );
        })}
      </div>
      <DimensionRail
        dimensions={dimensions}
        callType={callType}
        activeId={activeId}
        onJump={jump}
      />
    </div>
  );
}
