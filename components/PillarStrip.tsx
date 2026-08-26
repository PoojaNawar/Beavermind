"use client";

import type { PillarSummary } from "@/lib/scoring/scoreIfApplied";

function toneColor(tone: PillarSummary["tone"]): string {
  switch (tone) {
    case "good":
      return "var(--good)";
    case "mid":
      return "#8a6a12";
    case "bad":
      return "var(--danger)";
    default:
      return "var(--muted)";
  }
}

export function PillarStrip({
  pillars,
  showHeading = true,
}: {
  pillars: PillarSummary[];
  showHeading?: boolean;
}) {
  if (pillars.length === 0) return null;

  return (
    <div>
      {showHeading ? (
        <>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Pillars
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Connection · Confidence · Continuity
          </p>
        </>
      ) : null}
      <div className={`grid gap-4 sm:grid-cols-3 ${showHeading ? "mt-4" : ""}`}>
        {pillars.map((pillar) => {
          const pct =
            pillar.ratio === null ? 0 : Math.round(pillar.ratio * 100);
          return (
            <div key={pillar.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold tracking-tight">
                  {pillar.name}
                </p>
                <p
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: toneColor(pillar.tone) }}
                >
                  {pct}%
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-deep)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: toneColor(pillar.tone),
                  }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-[var(--muted)]">
                {pillar.earned}/{pillar.available}
                {pillar.dragged ? " · dragged the score" : ""}
              </p>
              {pillar.weakest ? (
                <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
                  Weakest: {pillar.weakest.name} ({pillar.weakest.score}/
                  {pillar.weakest.maxScore})
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Full marks across this pillar
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
