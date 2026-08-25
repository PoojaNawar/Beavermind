import { NextResponse } from "next/server";
import { getEvaluation, toClientEvaluation } from "@/lib/db/evaluations";
import { processEvaluation } from "@/lib/pipeline/processEvaluation";
import { canAcceptRetry } from "@/lib/processing/lease";
import { publicErrorMessage } from "@/lib/errors/evaluationError";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Run (or resume) evaluation in this invocation.
 * Vercel can freeze `after()` when the create request ends; the report page
 * calls this so the pipeline gets a full function time budget.
 */
export async function POST(
  _request: Request,
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

    await processEvaluation(id);
    const latest = await getEvaluation(id);
    if (!latest) {
      return NextResponse.json(
        { error: "Evaluation not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(toClientEvaluation(latest));
  } catch (err) {
    return NextResponse.json(
      { error: publicErrorMessage(err) },
      { status: 500 },
    );
  }
}
