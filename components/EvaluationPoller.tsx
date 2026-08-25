"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EvaluationAudit,
  EvaluationResult,
  EvaluationStatus,
} from "@/lib/rubrics/types";
import { EvaluationReport } from "./EvaluationReport";

interface PollPayload {
  id: string;
  callType: string;
  status: EvaluationStatus;
  stage: string | null;
  result: EvaluationResult | null;
  errorMessage: string | null;
  rubricVersion: string;
  createdAt: string;
  modelName: string | null;
  audit: EvaluationAudit;
  error?: string;
}

const EMPTY_AUDIT: EvaluationAudit = {
  provider: null,
  pipelineVersion: null,
  processingPath: null,
  chunkCount: null,
  modelCallCount: null,
  retryCount: 0,
  processingDurationMs: null,
  evidenceCount: null,
  verifiedEvidenceCount: null,
  rejectedEvidenceCount: null,
};

export function EvaluationPoller({ id }: { id: string }) {
  const [data, setData] = useState<PollPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/evaluations/${id}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setLoadError(json.error ?? "Failed to load evaluation.");
      return null;
    }
    setData(json);
    setLoadError(null);
    return json as PollPayload;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function drive() {
      while (!cancelled) {
        const snapshot = await load();
        if (cancelled || !snapshot) return;
        if (snapshot.status === "completed" || snapshot.status === "failed") {
          return;
        }

        const res = await fetch(`/api/evaluations/${id}/process`, {
          method: "POST",
        });
        if (cancelled) return;

        let json: PollPayload | null = null;
        try {
          json = (await res.json()) as PollPayload;
        } catch {
          json = null;
        }

        if (json && !json.error) {
          if (json.status === "completed" || json.status === "failed") {
            setData(json);
            setLoadError(null);
            return;
          }
          if (json.status === "pending") {
            continue;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    void drive();
    return () => {
      cancelled = true;
    };
  }, [id, load, pollEpoch]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const payload = await load();
      if (cancelled) return;
      if (
        payload &&
        (payload.status === "pending" || payload.status === "processing")
      ) {
        timer = setTimeout(tick, 750);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, pollEpoch]);

  async function onRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/process`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "Retry failed.");
        setRetrying(false);
        return;
      }
      setPollEpoch((n) => n + 1);
    } catch {
      setLoadError("Network error while retrying.");
    } finally {
      setRetrying(false);
    }
  }

  if (loadError && !data) {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-6 text-[var(--danger)]">
        {loadError}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
        Loading evaluation…
      </div>
    );
  }

  return (
    <EvaluationReport
      id={data.id}
      status={data.status}
      stage={data.stage ?? null}
      errorMessage={data.errorMessage}
      result={data.result}
      createdAt={data.createdAt}
      rubricVersion={data.rubricVersion}
      audit={data.audit ?? EMPTY_AUDIT}
      modelName={data.modelName ?? null}
      onRetry={data.status === "failed" ? onRetry : undefined}
      retrying={retrying}
    />
  );
}
