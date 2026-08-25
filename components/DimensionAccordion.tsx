"use client";

import { useState } from "react";
import type { DimensionResult, EvidenceItem } from "@/lib/rubrics/types";
import {
  dimensionEvidenceUi,
  isUnverifiedEvidence,
  isVerifiedEvidence,
} from "@/lib/transcripts/evidenceQuality";

function scoreTone(dim: DimensionResult): string {
  if (dim.disabled || dim.notApplicable) return "bg-[var(--bg-deep)] text-[var(--muted)]";
  const evidence = dimensionEvidenceUi(dim);
  if (evidence.tone === "warning") return "bg-[var(--warn-soft)] text-[var(--warn)]";
  if (dim.notDemonstrated) return "bg-[var(--warn-soft)] text-[var(--warn)]";
  const ratio =
    dim.score === null || dim.maxScore === 0 ? 0 : dim.score / dim.maxScore;
  if (ratio >= 0.85) return "bg-[var(--accent-soft)] text-[var(--accent)]";
  if (ratio >= 0.55) return "bg-[var(--bg-deep)] text-[var(--ink)]";
  return "bg-[var(--danger-soft)] text-[var(--danger)]";
}

function evidenceItemClasses(ev: EvidenceItem): string {
  if (ev.verificationStatus === "verified") {
    return "border-[var(--line)] bg-[var(--card)]";
  }
  if (ev.verificationStatus === "unverified") {
    return "border-[var(--warn)]/25 bg-[var(--warn-soft)]/60";
  }
  return "border-dashed border-[var(--line)] bg-[var(--bg)]/50";
}

function evidenceItemLabel(ev: EvidenceItem): string {
  if (ev.verificationStatus === "verified") return "VERIFIED";
  if (ev.verificationStatus === "unverified") return "UNVERIFIED";
  return "NOT DEMONSTRATED";
}

export function DimensionAccordion({
  dimensions,
}: {
  dimensions: DimensionResult[];
}) {
  const [openId, setOpenId] = useState<string | null>(dimensions[0]?.id ?? null);

  return (
    <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      {dimensions.map((dim) => {
        const open = openId === dim.id;
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

        return (
          <div key={dim.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : dim.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--bg)]/60"
              aria-expanded={open}
            >
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${scoreTone(dim)}`}
              >
                {scoreLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--ink)]">
                  {dim.name}
                </span>
                <span
                  className={`block text-xs ${
                    evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
                      ? "font-medium text-[var(--warn)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {dim.disabled
                    ? "Disabled for this call"
                    : dim.notApplicable
                      ? "Not applicable this cycle"
                      : `${evidenceUi.label} · Strength ${dim.evidenceStrength}`}
                </span>
              </span>
              <span className="text-[var(--muted)]" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>

            {open && (
              <div className="space-y-4 border-t border-[var(--line)] bg-[var(--bg)]/40 px-4 py-4">
                {dim.disabledReason && (
                  <p className="text-sm text-[var(--muted)]">
                    {dim.disabledReason}
                  </p>
                )}
                {dim.notApplicableReason && (
                  <p className="text-sm text-[var(--muted)]">
                    {dim.notApplicableReason}
                  </p>
                )}

                {!dim.disabled && !dim.notApplicable && (
                  <section
                    className={`rounded-lg px-3 py-2 ${
                      evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
                        ? "border border-[var(--warn)]/30 bg-[var(--warn-soft)]"
                        : "border border-[var(--line)] bg-[var(--card)]"
                    }`}
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Evidence status
                    </h4>
                    <p
                      className={`mt-1 text-sm font-semibold ${
                        evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
                          ? "text-[var(--warn)]"
                          : "text-[var(--ink)]"
                      }`}
                    >
                      {evidenceUi.label}
                    </p>
                    {evidenceUi.explanation && (
                      <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
                        {evidenceUi.explanation}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Evidence strength: {dim.evidenceStrength} (metadata only —
                      does not change the score)
                    </p>
                  </section>
                )}

                <section>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Rationale
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--ink)]">
                    {dim.rationale}
                  </p>
                </section>

                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Verified evidence
                  </h4>
                  {verifiedItems.length === 0 && unverifiedItems.length === 0 && ndItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)]">
                      No transcript evidence attached.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {verifiedItems.map((ev, i) => (
                        <li
                          key={`v-${i}`}
                          className={`rounded-lg border px-3 py-2 ${evidenceItemClasses(ev)}`}
                        >
                          <p className="font-mono text-[13px] leading-relaxed text-[var(--ink)]">
                            “{ev.quote}”
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {ev.speaker ? `${ev.speaker}` : "Speaker unknown"}
                            {ev.location ? ` · ${ev.location}` : ""}
                            {" · "}
                            {evidenceItemLabel(ev)}
                          </p>
                        </li>
                      ))}
                      {ndItems.map((ev, i) => (
                        <li
                          key={`nd-${i}`}
                          className={`rounded-lg border px-3 py-2 ${evidenceItemClasses(ev)}`}
                        >
                          <p className="text-sm text-[var(--muted)]">{ev.quote}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            {evidenceItemLabel(ev)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {unverifiedItems.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--warn)]">
                      Proposed but unverified evidence
                    </h4>
                    <ul className="space-y-2">
                      {unverifiedItems.map((ev, i) => (
                        <li
                          key={`u-${i}`}
                          className={`rounded-lg border px-3 py-2 ${evidenceItemClasses(ev)}`}
                        >
                          <p className="font-mono text-[13px] leading-relaxed text-[var(--ink)]">
                            “{ev.quote}”
                          </p>
                          <p className="mt-1 text-xs text-[var(--warn)]">
                            {evidenceItemLabel(ev)}
                            {ev.speaker ? ` · ${ev.speaker}` : ""}
                            {ev.location ? ` · ${ev.location}` : ""}
                            {" · not found in original transcript"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Quick fix
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--ink)]">
                    {dim.quickFix}
                  </p>
                </section>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
