import type { CallType } from "@/lib/rubrics/types";

export function historyCallTypeLabel(callType: CallType | string): string {
  return callType === "kickoff" ? "Kick-off call" : "Coaching call";
}

export function historyDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
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
