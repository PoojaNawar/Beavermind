import { NextResponse } from "next/server";
import { after } from "next/server";
import { getEvaluation } from "@/lib/db/evaluations";
import { processEvaluation } from "@/lib/pipeline/processEvaluation";
import { canAcceptRetry } from "@/lib/processing/lease";
import { publicErrorMessage } from "@/lib/errors/evaluationError";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const retry = canAcceptRetry({
      status: evaluation.status,
      updatedAt: evaluation.updatedAt,
    });

    if (!retry.accept) {
      return NextResponse.json(
        {
          error: retry.message,
          status: evaluation.status,
          stage: evaluation.stage,
        },
        { status: retry.httpStatus },
      );
    }

    after(async () => {
      await processEvaluation(id);
    });

    return NextResponse.json({
      id,
      status: evaluation.status,
      stage: evaluation.stage,
      message: retry.message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: publicErrorMessage(err) },
      { status: 500 },
    );
  }
}
