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

  it("recognizes coaching-02 live booking with booking link and half six", () => {
    const coaching02 = readFileSync(
      path.join(process.cwd(), "transcripts/coaching-02.txt"),
      "utf8",
    );
    expect(hasLiveNextCallBooking(coaching02)).toBe(true);
    expect(detectDeterministicCapIds("coaching", coaching02)).not.toContain(
      "next-call-not-booked",
    );
  });

  it("recognizes kickoff-01 live booking with calendar invite and o'clock time", () => {
    const kickoff01 = readFileSync(
      path.join(process.cwd(), "transcripts/kickoff-01.txt"),
      "utf8",
    );
    expect(hasLiveNextCallBooking(kickoff01)).toBe(true);
  });

  it("recognizes coaching-01 verbal lock-in despite later calendar deferral language", () => {
    const coaching01 = readFileSync(
      path.join(process.cwd(), "transcripts/coaching-01.txt"),
      "utf8",
    );
    expect(hasLiveNextCallBooking(coaching01)).toBe(true);
    expect(detectDeterministicCapIds("coaching", coaching01)).not.toContain(
      "next-call-not-booked",
    );
  });

  it("does not treat kickoff-02 assistant deferral as live booking", () => {
    expect(hasLiveNextCallBooking(kickoff02)).toBe(false);
  });

  it("fires next-call-not-booked whenever live booking is absent", () => {
    const silentClose =
      "Great session today. Talk soon and keep posting in the community.";
    expect(hasLiveNextCallBooking(silentClose)).toBe(false);
    expect(detectDeterministicCapIds("coaching", silentClose)).toContain(
      "next-call-not-booked",
    );
  });
});
