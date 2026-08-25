import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  detectDeterministicCapIds,
  hasLiveNextCallBooking,
  hasNorthStarMention,
  resolveFiredCapIds,
} from "@/lib/scoring/detectCaps";

const kickoff02 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-02.txt"),
  "utf8",
);
const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);

describe("deterministic cap detection", () => {
  it("detects no-north-star on kickoff-02", () => {
    expect(hasNorthStarMention(kickoff02)).toBe(false);
    expect(detectDeterministicCapIds("kickoff", kickoff02)).toContain(
      "no-north-star",
    );
  });

  it("does not fire no-north-star when North Star is present", () => {
    expect(hasNorthStarMention(kickoff01)).toBe(true);
    expect(detectDeterministicCapIds("kickoff", kickoff01)).not.toContain(
      "no-north-star",
    );
  });

  it("rejects model no-north-star when transcript contains North Star", () => {
    const ids = resolveFiredCapIds({
      callType: "kickoff",
      transcript: kickoff01,
      modelFiredIds: ["no-north-star", "coach-monologue"],
    });
    expect(ids).not.toContain("no-north-star");
    expect(ids).toContain("coach-monologue");
  });

  it("keeps model no-north-star when transcript lacks North Star", () => {
    const ids = resolveFiredCapIds({
      callType: "kickoff",
      transcript: kickoff02,
      modelFiredIds: ["no-north-star"],
    });
    expect(ids).toContain("no-north-star");
  });

  it("detects deferred booking as next-call-not-booked for coaching", () => {
    const deferred =
      "We'll talk next week. Honestly my assistant handles the scheduling on that side, so she'll reach out with some times.";
    expect(hasLiveNextCallBooking(deferred)).toBe(false);
    expect(detectDeterministicCapIds("coaching", deferred)).toContain(
      "next-call-not-booked",
    );
  });

  it("does not force next-call-not-booked when live booking is clear", () => {
    const live =
      "Let's get our next call locked in right now. Tuesday the ninth at 3pm — does that work? Perfect, locked.";
    expect(hasLiveNextCallBooking(live)).toBe(true);
    expect(detectDeterministicCapIds("coaching", live)).not.toContain(
      "next-call-not-booked",
    );
  });
});
