import { describe, expect, it } from "vitest";
import { canAcceptRetry, canClaimEvaluation } from "@/lib/processing/lease";

const STATUSES = ["pending", "processing", "completed", "failed"] as const;

describe("evaluation states", () => {
  it("defines the four processing states", () => {
    expect(STATUSES).toEqual(["pending", "processing", "completed", "failed"]);
  });

  it("aligns retry rules with lease helpers", () => {
    const now = Date.now();
    expect(
      canAcceptRetry({ status: "pending", updatedAt: null, now }).accept,
    ).toBe(true);
    expect(
      canAcceptRetry({ status: "failed", updatedAt: null, now }).accept,
    ).toBe(true);
    expect(
      canAcceptRetry({
        status: "processing",
        updatedAt: new Date(now).toISOString(),
        now,
      }).accept,
    ).toBe(false);
    expect(
      canAcceptRetry({
        status: "completed",
        updatedAt: new Date(now).toISOString(),
        now,
      }).accept,
    ).toBe(false);
  });

  it("does not overwrite a completed evaluation on claim", () => {
    expect(
      canClaimEvaluation({
        status: "completed",
        updatedAt: new Date().toISOString(),
      }).claimable,
    ).toBe(false);
  });
});
