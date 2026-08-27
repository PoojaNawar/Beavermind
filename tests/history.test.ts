import { describe, expect, it } from "vitest";
import { toHistoryItem } from "@/lib/db/evaluations";
import {
  DEFAULT_HISTORY_STARTED_AT,
  formatHistoryTimestamp,
  historyCallTypeLabel,
  historyDisplayName,
  historyEvaluationId,
  historyStatusLabel,
  isInHistoryWindow,
} from "@/lib/ui/history";

describe("evaluation history mapping", () => {
  it("maps list rows without requiring transcript or result", () => {
    const item = toHistoryItem({
      id: "eval-1",
      call_type: "kickoff",
      client_name: "Owen Brandt",
      coach_name: "Dana",
      status: "completed",
      created_at: "2026-08-25T12:00:00.000Z",
    });

    expect(item).toEqual({
      id: "eval-1",
      callType: "kickoff",
      clientName: "Owen Brandt",
      coachName: "Dana",
      status: "completed",
      createdAt: "2026-08-25T12:00:00.000Z",
    });
  });

  it("falls back to null names when subject columns are missing", () => {
    const item = toHistoryItem({
      id: "eval-2",
      call_type: "coaching",
      status: "processing",
      created_at: "2026-08-25T12:00:00.000Z",
    });

    expect(item.clientName).toBeNull();
    expect(item.coachName).toBeNull();
    expect(item.callType).toBe("coaching");
  });
});

describe("evaluation history display", () => {
  it("labels kick-off and coaching call types", () => {
    expect(historyCallTypeLabel("kickoff")).toBe("Kick-off");
    expect(historyCallTypeLabel("coaching")).toBe("Coaching");
  });

  it("labels processing status separately from call type", () => {
    expect(historyStatusLabel("completed")).toBe("Completed");
    expect(historyStatusLabel("failed")).toBe("Failed");
    expect(historyStatusLabel("processing")).toBe("Processing");
    expect(historyStatusLabel("pending")).toBe("Queued");
  });

  it("shows a dash for a missing coach name", () => {
    expect(historyDisplayName(null)).toBe("—");
    expect(historyDisplayName("  ")).toBe("—");
    expect(historyDisplayName("Dana")).toBe("Dana");
  });

  it("shortens the evaluation id for the table", () => {
    expect(historyEvaluationId("80ef3cd9-1227-484f-be78-7e28db7d9f0b")).toBe(
      "80ef3cd9",
    );
  });

  it("formats a timestamp with date and time", () => {
    expect(
      formatHistoryTimestamp("2026-08-25T14:05:00.000Z", "en-US", "UTC"),
    ).toBe("Aug 25, 2026, 2:05 PM");
  });

  it("hides evaluations created before the history window", () => {
    expect(
      isInHistoryWindow("2026-08-26T15:00:00.000Z", DEFAULT_HISTORY_STARTED_AT),
    ).toBe(false);
    expect(
      isInHistoryWindow("2026-08-27T12:40:00.000Z", DEFAULT_HISTORY_STARTED_AT),
    ).toBe(true);
  });
});
