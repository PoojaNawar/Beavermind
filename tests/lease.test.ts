import { describe, expect, it } from "vitest";
import {
  canAcceptRetry,
  canClaimEvaluation,
  isLeaseExpired,
  PROCESSING_LEASE_MS,
} from "@/lib/processing/lease";

describe("processing lease", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");

  it("treats missing or invalid timestamps as expired", () => {
    expect(isLeaseExpired(null, now)).toBe(true);
    expect(isLeaseExpired("not-a-date", now)).toBe(true);
  });

  it("active evaluation cannot be reclaimed while lease is fresh", () => {
    const updatedAt = new Date(now - 60_000).toISOString(); // 1 min ago
    const decision = canClaimEvaluation({
      status: "processing",
      updatedAt,
      now,
    });
    expect(decision.claimable).toBe(false);
    expect(decision.reason).toBe("active-lease");
    expect(isLeaseExpired(updatedAt, now)).toBe(false);
  });

  it("genuinely stale evaluation can be reclaimed", () => {
    const updatedAt = new Date(now - PROCESSING_LEASE_MS - 1).toISOString();
    const decision = canClaimEvaluation({
      status: "processing",
      updatedAt,
      now,
    });
    expect(decision.claimable).toBe(true);
    expect(decision.reason).toBe("stale-processing");
  });

  it("completed evaluation cannot be reclaimed", () => {
    const decision = canClaimEvaluation({
      status: "completed",
      updatedAt: new Date(now - PROCESSING_LEASE_MS * 2).toISOString(),
      now,
    });
    expect(decision.claimable).toBe(false);
    expect(decision.reason).toBe("completed");
  });

  it("retry does not duplicate processing for an active lease", () => {
    const retry = canAcceptRetry({
      status: "processing",
      updatedAt: new Date(now - 30_000).toISOString(),
      now,
    });
    expect(retry.accept).toBe(false);
    expect(retry.httpStatus).toBe(409);
  });

  it("retry accepts pending, failed, and stale processing", () => {
    expect(
      canAcceptRetry({ status: "pending", updatedAt: null, now }).accept,
    ).toBe(true);
    expect(
      canAcceptRetry({ status: "failed", updatedAt: null, now }).accept,
    ).toBe(true);
    expect(
      canAcceptRetry({
        status: "processing",
        updatedAt: new Date(now - PROCESSING_LEASE_MS - 5_000).toISOString(),
        now,
      }).accept,
    ).toBe(true);
  });

  it("retry rejects completed evaluations", () => {
    const retry = canAcceptRetry({
      status: "completed",
      updatedAt: new Date(now).toISOString(),
      now,
    });
    expect(retry.accept).toBe(false);
    expect(retry.httpStatus).toBe(409);
  });
});
