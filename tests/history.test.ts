import { describe, expect, it } from "vitest";
import { toHistoryItem } from "@/lib/db/evaluations";
import {
  formatHistoryTimestamp,
  historyCallTypeLabel,
  historyDisplayName,
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
  it("labels kick-off and coaching types", () => {
    expect(historyCallTypeLabel("kickoff")).toBe("Kick-off call");
    expect(historyCallTypeLabel("coaching")).toBe("Coaching call");
  });

  it("shows a dash for a missing coach name", () => {
    expect(historyDisplayName(null)).toBe("—");
    expect(historyDisplayName("  ")).toBe("—");
    expect(historyDisplayName("Dana")).toBe("Dana");
  });

  it("formats a timestamp with date and time", () => {
    expect(
      formatHistoryTimestamp("2026-08-25T14:05:00.000Z", "en-US", "UTC"),
    ).toBe("Aug 25, 2026, 2:05 PM");
  });
});
