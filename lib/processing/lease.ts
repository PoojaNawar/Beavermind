import { env } from "@/lib/env";

/**
 * Processing lease / heartbeat.
 *
 * WHY not a 2-minute wall clock from start:
 * Chunked evaluations routinely take several minutes (multiple sequential
 * model calls). A short "started_at" timeout incorrectly reclaims live work.
 *
 * Design:
 * - While processing, the worker heartbeats by touching the row (bumps updated_at).
 * - A row is stale only if status=processing AND updated_at is older than the lease.
 * - Lease (5 min) is longer than the heartbeat interval (45s) with margin for
 *   slow model calls, but short enough to recover after a killed worker.
 * - Completed rows are never reclaimable.
 */

/** No heartbeat within this window ⇒ treat processing as dead. */
export const PROCESSING_LEASE_MS = 5 * 60 * 1000;

/** How often an active worker refreshes the lease. */
export const HEARTBEAT_INTERVAL_MS = 45_000;

export function isLeaseExpired(
  lastTouchIso: string | null | undefined,
  now = Date.now(),
  leaseMs = PROCESSING_LEASE_MS,
): boolean {
  if (!lastTouchIso) return true;
  const touched = Date.parse(lastTouchIso);
  if (!Number.isFinite(touched)) return true;
  return now - touched >= leaseMs;
}

/**
 * Whether a second worker may claim/reclaim this evaluation.
 * Pure decision helper — used by claimForProcessing, processEvaluation, and retry.
 */
export function canClaimEvaluation(args: {
  status: string;
  updatedAt: string | null | undefined;
  now?: number;
  leaseMs?: number;
}): { claimable: boolean; reason: string } {
  const { status, updatedAt, now, leaseMs } = args;

  if (status === "completed") {
    return { claimable: false, reason: "completed" };
  }
  if (status === "pending" || status === "failed") {
    return { claimable: true, reason: status };
  }
  if (status === "processing") {
    if (isLeaseExpired(updatedAt, now, leaseMs)) {
      return { claimable: true, reason: "stale-processing" };
    }
    return { claimable: false, reason: "active-lease" };
  }
  return { claimable: false, reason: "unknown-status" };
}

/**
 * Retry HTTP semantics: completed/active-lease → reject; pending/failed/stale → accept.
 */
export function canAcceptRetry(args: {
  status: string;
  updatedAt: string | null | undefined;
  now?: number;
  leaseMs?: number;
}): { accept: boolean; httpStatus: 200 | 409; message: string } {
  const decision = canClaimEvaluation(args);
  if (args.status === "completed") {
    return {
      accept: false,
      httpStatus: 409,
      message: "This evaluation is already completed and cannot be retried.",
    };
  }
  if (!decision.claimable && decision.reason === "active-lease") {
    return {
      accept: false,
      httpStatus: 409,
      message: "This evaluation is already processing.",
    };
  }
  if (!decision.claimable) {
    return {
      accept: false,
      httpStatus: 409,
      message: "This evaluation cannot be retried in its current state.",
    };
  }
  return {
    accept: true,
    httpStatus: 200,
    message: "Retry started.",
  };
}

/** Starts a lease heartbeat; call the returned stop function in finally. */
export function startProcessingHeartbeat(
  touch: () => Promise<void>,
  intervalMs = HEARTBEAT_INTERVAL_MS,
): () => void {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    void touch().catch(() => {
      /* lease touch failures are non-fatal; next tick may succeed */
    });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
