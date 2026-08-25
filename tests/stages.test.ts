import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  coarseStatusFromStage,
  EVALUATION_STAGES,
  isInFlightStage,
  stageFromLegacyStatus,
} from "@/lib/pipeline/stages";
import { canClaimEvaluation, canAcceptRetry } from "@/lib/processing/lease";

describe("pipeline stages", () => {
  it("lists the canonical stages", () => {
    expect(EVALUATION_STAGES).toEqual([
      "pending",
      "extracting_evidence",
      "aggregating_evidence",
      "evaluating",
      "validating",
      "scoring",
      "completed",
      "failed",
    ]);
  });

  it("allows valid forward transitions", () => {
    expect(canTransition("pending", "extracting_evidence")).toBe(true);
    expect(canTransition("pending", "evaluating")).toBe(true);
    expect(canTransition("extracting_evidence", "aggregating_evidence")).toBe(true);
    expect(canTransition("evaluating", "validating")).toBe(true);
    expect(canTransition("validating", "scoring")).toBe(true);
    expect(canTransition("scoring", "completed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("evaluating", "extracting_evidence")).toBe(false);
    expect(canTransition("completed", "pending")).toBe(false);
    expect(canTransition("scoring", "evaluating")).toBe(false);
    expect(() => assertTransition("completed", "failed")).toThrow(/Invalid pipeline/);
  });

  it("completed cannot move backwards", () => {
    for (const stage of EVALUATION_STAGES) {
      if (stage === "completed") continue;
      expect(canTransition("completed", stage)).toBe(false);
    }
  });

  it("failed can be retried safely", () => {
    expect(canTransition("failed", "pending")).toBe(true);
    expect(canTransition("failed", "extracting_evidence")).toBe(true);
    expect(canTransition("failed", "evaluating")).toBe(true);
    expect(
      canAcceptRetry({ status: "failed", updatedAt: null, now: Date.now() }).accept,
    ).toBe(true);
  });

  it("in-flight stages map to processing for the lease lock", () => {
    expect(coarseStatusFromStage("extracting_evidence")).toBe("processing");
    expect(coarseStatusFromStage("scoring")).toBe("processing");
    expect(isInFlightStage("evaluating")).toBe(true);
    expect(isInFlightStage("completed")).toBe(false);
  });

  it("processing cannot be claimed by two workers while the lease is fresh", () => {
    const now = Date.now();
    const decision = canClaimEvaluation({
      status: "processing",
      updatedAt: new Date(now).toISOString(),
      now,
    });
    expect(decision.claimable).toBe(false);
    expect(decision.reason).toBe("active-lease");
  });

  it("does not invent in-flight stages for legacy processing rows", () => {
    expect(stageFromLegacyStatus("processing", null)).toBeNull();
    expect(stageFromLegacyStatus("completed", null)).toBe("completed");
    expect(stageFromLegacyStatus("processing", "evaluating")).toBe("evaluating");
  });
});
