"use client";

import { useEffect, useMemo, useState } from "react";
import type { DimensionResult, EvaluationResult, EvidenceItem } from "@/lib/rubrics/types";
import {
  dimensionEvidenceUi,
  isUnverifiedEvidence,
  isVerifiedEvidence,
} from "@/lib/transcripts/evidenceQuality";
import {
  dimensionStatusLabel,
  evidenceItemLabel,
  notApplicableCopy,
  scoreExplanation,
  whyNotFullMarksCopy,
} from "@/lib/ui/reportPresentation";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";

const QUOTE_PREVIEW_CHARS = 160;

function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf(".\""),
    slice.lastIndexOf(".”"),
  );
  if (sentenceEnd > maxChars * 0.45) {
    return slice.slice(0, sentenceEnd + 1).trimEnd();
  }
  const wordEnd = slice.lastIndexOf(" ");
  if (wordEnd > maxChars * 0.55) {
    return slice.slice(0, wordEnd).trimEnd();
  }
  return slice.trimEnd();
}

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
    <section className="mt-6 border-t border-[var(--line)] pt-5">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Quick fix
      </h4>
      <p
        className={`mt-2 tracking-tight ${
          quickFix.complete
            ? "text-sm font-medium text-[var(--muted)]"
            : "text-[17px] font-semibold leading-snug text-[var(--ink)] sm:text-[18px]"
        }`}
      >
        {quickFix.title}
      </p>
      {quickFix.body ? (
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]">
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

function EvidenceQuote({
  ev,
  kind,
}: {
  ev: EvidenceItem;
  kind: "verified" | "unverified" | "not_demonstrated";
}) {
  const meta = evidenceItemLabel(kind);
  const muted = kind !== "verified";
  const full =
    kind === "not_demonstrated"
      ? ev.quote
      : `${ev.speaker ? `${ev.speaker}: ` : ""}“${ev.quote}”`;
  const needsCollapse = full.length > QUOTE_PREVIEW_CHARS;
  const [expanded, setExpanded] = useState(false);
  const preview = truncateAtBoundary(full, QUOTE_PREVIEW_CHARS);
  const shown =
    needsCollapse && !expanded
      ? `${preview}…`
      : full;

  return (
    <li className="min-w-0">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          kind === "verified"
            ? "text-[var(--ink)]"
            : kind === "unverified"
              ? "text-[#8a6a12]"
              : "text-[var(--muted)]"
        }`}
      >
        {meta.mark} {meta.label.toUpperCase()}
      </p>
      <blockquote
        className={`mt-1.5 border-l-2 pl-3 text-[14px] leading-relaxed break-words ${
          muted
            ? "border-[#d4b84a]/50 text-[#8a6a12]"
            : "border-[var(--line)] text-[var(--ink)]"
        }`}
      >
        {shown}
      </blockquote>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          {expanded ? "Show less" : "Show full quote"}
        </button>
      ) : null}
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
  focusId,
  focusKey = 0,
}: {
  dimensions: DimensionResult[];
  callType: string;
  firedResult: EvaluationResult;
  focusId?: string | null;
  focusKey?: number;
}) {
  const seed = useMemo(() => initialOpenIds(dimensions), [dimensions]);
  const [openIds, setOpenIds] = useState<Set<string>>(seed);

  useEffect(() => {
    if (!focusId) return;
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.add(focusId);
      return next;
    });
    const el = document.getElementById(`dim-${focusId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, focusKey]);

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
          ? "NOT APPLICABLE"
          : `${dim.score} / ${dim.maxScore}`;
        const evidenceUi = dimensionEvidenceUi(dim);
        const status = dimensionStatusLabel(dim, firedResult);
        const verifiedItems = dim.evidence.filter(isVerifiedEvidence);
        const unverifiedItems = dim.evidence.filter(isUnverifiedEvidence);
        const ndItems = dim.evidence.filter(
          (e) => e.verificationStatus === "not_demonstrated",
        );
        const hasEvidence =
          verifiedItems.length + unverifiedItems.length + ndItems.length > 0;
        const assessment = na ? na.explanation : scoreExplanation(dim);
        const whyNotFull = na ? null : whyNotFullMarksCopy(dim);
        const evidenceCountParts: string[] = [];
        if (verifiedItems.length > 0) {
          evidenceCountParts.push(`${verifiedItems.length} verified`);
        }
        if (unverifiedItems.length > 0) {
          evidenceCountParts.push(`${unverifiedItems.length} unverified`);
        }
        if (ndItems.length > 0) {
          evidenceCountParts.push(`${ndItems.length} not demonstrated`);
        }

        return (
          <article
            key={dim.id}
            id={`dim-${dim.id}`}
            className="scroll-mt-10 border-t border-[var(--line)]"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(dim.id)}
              className="flex w-full items-start justify-between gap-3 py-5 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold tracking-tight sm:text-[18px]">
                  <span className="text-[var(--muted)]">{index + 1}.</span>{" "}
                  {dim.name}
                </h3>
                <p className="font-display mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight">
                  {scoreLabel}
                </p>
                {status ? (
                  <p
                    className={`mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      status === "CRITICAL"
                        ? "text-[var(--danger)]"
                        : status === "FULL MARKS"
                          ? "text-[var(--good)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {status}
                  </p>
                ) : null}
                {!open ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                    {assessment}
                  </p>
                ) : null}
              </div>
              <svg
                viewBox="0 0 16 16"
                className={`mt-1 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
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
            </button>

            {open ? (
              <div className="pb-6">
                <section>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Judge assessment
                  </h4>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]">
                    {assessment}
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
                </section>

                {whyNotFull ? (
                  <section className="mt-6 border-t border-[var(--line)] pt-5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Why not full marks
                    </h4>
                    <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]">
                      {whyNotFull}
                    </p>
                  </section>
                ) : null}

                <section className="mt-6">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Evidence
                    {evidenceCountParts.length > 0
                      ? ` · ${evidenceCountParts.join(" · ")}`
                      : ""}
                  </h4>
                  {!hasEvidence ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {na
                        ? "This dimension was not scored."
                        : "No transcript evidence attached."}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-4">
                      {verifiedItems.map((ev, i) => (
                        <EvidenceQuote key={`v-${i}`} ev={ev} kind="verified" />
                      ))}
                      {unverifiedItems.map((ev, i) => (
                        <EvidenceQuote
                          key={`u-${i}`}
                          ev={ev}
                          kind="unverified"
                        />
                      ))}
                      {ndItems.map((ev, i) => (
                        <EvidenceQuote
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
