import type { CallType } from "@/lib/rubrics/types";
import type { EvaluationStatus } from "@/lib/rubrics/types";

export const DEFAULT_HISTORY_STARTED_AT = "2026-08-27T12:40:00.000Z";

export function isInHistoryWindow(
  createdAt: string,
  startedAt = DEFAULT_HISTORY_STARTED_AT,
): boolean {
  const created = Date.parse(createdAt);
  const start = Date.parse(startedAt);
  if (!Number.isFinite(created) || !Number.isFinite(start)) return false;
  return created >= start;
}

export function historyCallTypeLabel(callType: CallType | string): string {
  return callType === "kickoff" ? "Kick-off" : "Coaching";
}

export function historyStatusLabel(status: EvaluationStatus | string): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing";
  return "Queued";
}

export function historyDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function historyEvaluationId(id: string): string {
  return id.slice(0, 8);
}

export function formatHistoryTimestamp(
  iso: string,
  locale = "en-US",
  timeZone?: string,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}
