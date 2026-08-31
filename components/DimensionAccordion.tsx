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
import { capNoteForDimension } from "@/lib/scoring/meritCaps";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";

const QUOTE_PREVIEW_CHARS = 160;

function statusLabelTone(status: string): string {
  if (status === "CRITICAL") return "text-[var(--danger)]";
  if (status === "FULL MARKS") return "text-[var(--good)]";
  if (
    status === "OPPORTUNITY" ||
    status === "MINOR OPPORTUNITY" ||
    status === "SIGNIFICANT GAP"
  ) {
    return "text-[var(--warn)]";
  }
  return "text-[var(--muted)]";
}

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
        const capNote = na ? null : capNoteForDimension(dim);
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
                    className={`mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusLabelTone(status)}`}
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

                {capNote ? (
                  <section className="mt-6 border-t border-[var(--line)] pt-5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Cap check
                    </h4>
                    <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]">
                      {capNote}
                    </p>
                  </section>
                ) : null}

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

                {dim.criteriaResults && dim.criteriaResults.length > 0 ? (
                  <section className="mt-6 border-t border-[var(--line)] pt-5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Rubric criteria
                    </h4>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Rule → verified evidence → result. Quote existence is
                      checked separately from whether the rule is satisfied.
                    </p>
                    <ul className="mt-3 space-y-3">
                      {dim.criteriaResults.map((rule) => (
                        <li
                          key={rule.id}
                          className="rounded-lg border border-[var(--line)] bg-[var(--card)]/40 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                                rule.status === "met"
                                  ? "text-[var(--good)]"
                                  : rule.status === "partial"
                                    ? "text-[var(--warn)]"
                                    : rule.status === "not_met"
                                      ? "text-[var(--danger)]"
                                      : "text-[var(--muted)]"
                              }`}
                            >
                              {rule.status === "met"
                                ? "Met"
                                : rule.status === "partial"
                                  ? "Partial"
                                  : rule.status === "not_met"
                                    ? "Not met"
                                    : "N/A"}
                            </span>
                            <span className="text-sm font-medium text-[var(--ink)]">
                              {rule.label}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
                            {rule.note}
                          </p>
                          {rule.evidenceQuote ? (
                            <blockquote className="mt-2 border-l-2 border-[var(--line)] pl-3 text-[13px] leading-relaxed text-[var(--muted)]">
                              {rule.evidenceSpeaker
                                ? `${rule.evidenceSpeaker}: `
                                : ""}
                              “{rule.evidenceQuote}”
                            </blockquote>
                          ) : rule.status !== "met" ? (
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              No verified transcript line proves this rule —
                              requirement treated as absent.
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
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
                    <>
                      {evidenceCountParts.length > 0 ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {evidenceCountParts.join(" · ")} — only verified
                          quotes support the score.
                        </p>
                      ) : null}
                      {verifiedItems.length > 0 ? (
                        <ul className="mt-3 space-y-4">
                          {verifiedItems.map((ev, i) => (
                            <EvidenceQuote
                              key={`v-${i}`}
                              ev={ev}
                              kind="verified"
                            />
                          ))}
                        </ul>
                      ) : null}
                      {unverifiedItems.length > 0 || ndItems.length > 0 ? (
                        <div
                          className={`${
                            verifiedItems.length > 0
                              ? "mt-4 border-t border-[var(--line)] pt-4"
                              : "mt-3"
                          } rounded-lg bg-[var(--card)]/60 px-3 py-3 sm:px-4`}
                        >
                          <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
                            Unverified means our system proposed this as
                            supporting evidence but could not confirm the exact
                            wording in the transcript — it is a check on the AI,
                            not a mark against you.
                          </p>
                          <ul className="space-y-4">
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
                        </div>
                      ) : null}
                    </>
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
