import { after, NextResponse } from "next/server";
import { getEvaluation, toClientEvaluation } from "@/lib/db/evaluations";
import { processEvaluation } from "@/lib/pipeline/processEvaluation";
import { canAcceptRetry } from "@/lib/processing/lease";
import {
  publicErrorMessage,
  sanitizeDiagnostic,
} from "@/lib/errors/evaluationError";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Run or resume evaluation in this invocation.
 * Vercel runs one phase per call: all extract chunks in parallel, then
 * each synthesis half. The report page starts the next phase.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const evaluation = await getEvaluation(id);

    if (!evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found." },
        { status: 404 },
      );
    }

    if (evaluation.status === "completed") {
      return NextResponse.json(toClientEvaluation(evaluation));
    }

    const retry = canAcceptRetry({
      status: evaluation.status,
      updatedAt: evaluation.updatedAt,
    });

    if (!retry.accept) {
      return NextResponse.json({
        id,
        status: evaluation.status,
        stage: evaluation.stage,
        message: retry.message,
      });
    }

    const outcome = await processEvaluation(id);
    const latest = await getEvaluation(id);
    if (!latest) {
      return NextResponse.json(
        { error: "Evaluation not found." },
        { status: 404 },
      );
    }

    if (outcome === "yielded") {
      const nextUrl = new URL(
        `/api/evaluations/${id}/process`,
        request.url,
      ).toString();
      after(() => {
        void fetch(nextUrl, { method: "POST" }).catch(() => {
          /* report page also drives the next step */
        });
      });
    }

    return NextResponse.json(toClientEvaluation(latest));
  } catch (err) {
    console.warn(`[evaluations process] ${sanitizeDiagnostic(err)}`);
    return NextResponse.json(
      { error: publicErrorMessage(err) },
      { status: 500 },
    );
  }
}
