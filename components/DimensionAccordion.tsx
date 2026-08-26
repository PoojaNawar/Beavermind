"use client";

import { useMemo, useState } from "react";
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
    <section className="mt-5 border-t border-[var(--line)] pt-4">
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
        {quickFix.complete ? "Full marks reached" : quickFix.title}
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
      <p className="mt-0.5 text-xs text-[var(--muted)]">{meta.hint}</p>
    </li>
  );
}

function initialOpenIds(dimensions: DimensionResult[]): Set<string> {
  const missed = dimensions.filter(
    (d) =>
      !d.disabled &&
      !d.notApplicable &&
      d.score !== null &&
      d.score < d.maxScore,
  );
  if (missed.length > 0) {
    return new Set(missed.slice(0, 2).map((d) => d.id));
  }
  return new Set(dimensions[0] ? [dimensions[0].id] : []);
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
  const seed = useMemo(() => initialOpenIds(dimensions), [dimensions]);
  const [openIds, setOpenIds] = useState<Set<string>>(seed);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-0">
      {dimensions.map((dim, index) => {
        const open = openIds.has(dim.id);
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
        const preview = na
          ? na.explanation
          : scoreExplanation(dim);

        return (
          <article
            key={dim.id}
            id={`dim-${dim.id}`}
            className="scroll-mt-8 border-t border-[var(--line)]"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(dim.id)}
              className="flex w-full items-start justify-between gap-3 py-4 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold tracking-tight">
                  <span className="text-[var(--muted)]">{index + 1}.</span>{" "}
                  {dim.name}
                </h3>
                {impact ? (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {impactLabel(impact)}
                  </p>
                ) : null}
                {!open ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                    {preview}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${scorePillClass(dimensionTone(dim))}`}
                >
                  {scoreLabel}
                </span>
                <svg
                  viewBox="0 0 16 16"
                  className={`h-4 w-4 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 6.5 8 10.5 12 6.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {open ? (
              <div className="pb-5">
                <p className="max-w-prose text-[15px] leading-relaxed text-[var(--ink)]">
                  {preview}
                </p>

                {!na && evidenceUi.explanation ? (
                  <p
                    className={`mt-2 text-xs ${
                      evidenceUi.tone === "warning" ||
                      evidenceUi.tone === "caution"
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
                        <EvidenceRow
                          key={`u-${i}`}
                          ev={ev}
                          kind="unverified"
                        />
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
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
