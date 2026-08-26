"use client";

import { useEffect, useState } from "react";
import type { DimensionResult, EvaluationResult, EvidenceItem } from "@/lib/rubrics/types";
import {
  dimensionEvidenceUi,
  isUnverifiedEvidence,
  isVerifiedEvidence,
} from "@/lib/transcripts/evidenceQuality";
import {
  dimensionImpact,
  evidenceItemLabel,
  impactLabel,
  notApplicableCopy,
  scoreExplanation,
} from "@/lib/ui/reportPresentation";
import {
  dimensionTone,
  scorePillClass,
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
    <section className="mt-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Quick fix
      </h4>
      <p
        className={`mt-2 text-sm font-semibold tracking-tight ${
          quickFix.complete
            ? "text-[var(--muted)]"
            : "uppercase tracking-[0.04em] text-[var(--ink)]"
        }`}
      >
        {quickFix.complete
          ? "Full marks reached"
          : quickFix.title}
      </p>
      {quickFix.body ? (
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-[var(--ink)]">
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

function EvidenceRow({
  ev,
  kind,
}: {
  ev: EvidenceItem;
  kind: "verified" | "unverified" | "not_demonstrated";
}) {
  const meta = evidenceItemLabel(kind);
  const muted = kind !== "verified";

  return (
    <li className="max-w-prose text-[14px] leading-relaxed">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          kind === "verified"
            ? "text-[var(--ink)]"
            : kind === "unverified"
              ? "text-[#8a6a12]"
              : "text-[var(--muted)]"
        }`}
      >
        {meta.mark} {meta.label}
      </p>
      {kind === "not_demonstrated" ? (
        <p className="mt-1 text-[var(--muted)]">{ev.quote}</p>
      ) : (
        <p className={`mt-1 ${muted ? "text-[#8a6a12]" : "text-[var(--ink)]"}`}>
          {ev.speaker ? `${ev.speaker}: ` : ""}
          “{ev.quote}”
        </p>
      )}
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {meta.hint}
        {ev.location ? ` · ${ev.location}` : ""}
      </p>
    </li>
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
  firedResult,
}: {
  dimensions: DimensionResult[];
  callType: string;
  firedResult: EvaluationResult;
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
      <div className="space-y-10">
        {dimensions.map((dim, index) => {
          const na = notApplicableCopy(dim);
          const scoreLabel = na
            ? "Not applicable"
            : `${dim.score}/${dim.maxScore}`;
          const evidenceUi = dimensionEvidenceUi(dim);
          const impact = dimensionImpact(dim, firedResult);
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
              className="scroll-mt-8 border-t border-[var(--line)] pt-6 first:border-t-0 first:pt-0"
            >
              <header className="flex items-start justify-between gap-4">
                <h3 className="min-w-0 text-[17px] font-semibold tracking-tight">
                  <span className="text-[var(--muted)]">{index + 1}.</span>{" "}
                  {dim.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${scorePillClass(dimensionTone(dim))}`}
                >
                  {scoreLabel}
                </span>
              </header>

              {impact ? (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {impactLabel(impact)}
                </p>
              ) : null}

              <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">
                {na ? na.explanation : scoreExplanation(dim)}
              </p>

              {!na && evidenceUi.explanation ? (
                <p
                  className={`mt-2 text-xs ${
                    evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
                      ? "text-[#8a6a12]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {evidenceUi.label}
                  {` — ${evidenceUi.explanation}`}
                </p>
              ) : null}

              <section className="mt-5">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Evidence
                </h4>
                {!hasEvidence ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {na
                      ? "This dimension was not scored."
                      : "No transcript evidence attached."}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {verifiedItems.map((ev, i) => (
                      <EvidenceRow key={`v-${i}`} ev={ev} kind="verified" />
                    ))}
                    {unverifiedItems.map((ev, i) => (
                      <EvidenceRow key={`u-${i}`} ev={ev} kind="unverified" />
                    ))}
                    {ndItems.map((ev, i) => (
                      <EvidenceRow
                        key={`nd-${i}`}
                        ev={ev}
                        kind="not_demonstrated"
                      />
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
