import type { DimensionResult } from "@/lib/rubrics/types";
import { dimensionRatio, dimensionTone, toneFill } from "@/lib/ui/scoreTone";

export function ScoreGauge({
  score,
  grade,
}: {
  score: number;
  grade: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 58;
  const cx = 90;
  const cy = 78;
  const length = Math.PI * r;
  const filled = (clamped / 100) * length;
  const labelTone =
    grade === "Fail" || grade === "At risk"
      ? "var(--danger)"
      : grade === "Inconsistent"
        ? "var(--warn)"
        : "var(--good)";

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative h-[124px] w-[220px]">
        <svg
          viewBox="0 0 180 104"
          className="h-full w-full"
          role="img"
          aria-label={`Score ${clamped} out of 100, ${grade}`}
        >
          <defs>
            <linearGradient id="bm-gauge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c0392b" />
              <stop offset="48%" stopColor="#d4a017" />
              <stop offset="100%" stopColor="#2f6f4e" />
            </linearGradient>
          </defs>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="var(--line)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="url(#bm-gauge)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${length}`}
          />
        </svg>
        <p className="absolute inset-x-0 bottom-1 text-center text-[32px] font-semibold tabular-nums leading-none tracking-tight">
          {clamped}
          <span className="text-lg font-medium text-[var(--muted)]"> / 100</span>
        </p>
      </div>
      <p
        className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ color: labelTone }}
      >
        {grade}
      </p>
    </div>
  );
}

export function ScoreStrip({
  dimensions,
  onSelect,
}: {
  dimensions: DimensionResult[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div
      className="flex h-9 w-full items-end gap-1"
      role={onSelect ? "navigation" : undefined}
      aria-label={onSelect ? "Jump to dimension by score" : undefined}
    >
      {dimensions.map((dim) => {
        const ratio = dimensionRatio(dim);
        const tone = dimensionTone(dim);
        const label = `${dim.name} ${dim.score ?? "—"}/${dim.maxScore}`;
        const style = {
          height: `${Math.round((ratio ?? 0.18) * 36)}px`,
          background: toneFill(tone),
          opacity: tone === "muted" ? 0.45 : 0.9,
        } as const;

        if (onSelect) {
          return (
            <button
              key={dim.id}
              type="button"
              title={label}
              aria-label={`Go to ${label}`}
              onClick={() => onSelect(dim.id)}
              className="min-w-0 flex-1 rounded-[3px] transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
              style={style}
            />
          );
        }

        return (
          <div
            key={dim.id}
            className="flex-1 rounded-[3px]"
            title={label}
            style={style}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
