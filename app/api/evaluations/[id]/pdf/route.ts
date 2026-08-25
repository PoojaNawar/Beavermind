import { NextResponse } from "next/server";
import { getEvaluation } from "@/lib/db/evaluations";
import { isPipelineCheckpoint } from "@/lib/pipeline/checkpoint";
import { buildEvaluationPdf } from "@/lib/pdf/generate";
import { publicErrorMessage } from "@/lib/errors/evaluationError";

export const runtime = "nodejs";

export async function GET(
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

    if (
      evaluation.status !== "completed" ||
      !evaluation.result ||
      isPipelineCheckpoint(evaluation.result)
    ) {
      return NextResponse.json(
        {
          error:
            evaluation.status === "failed"
              ? "Cannot generate a PDF for a failed evaluation."
              : "Evaluation is not completed yet.",
        },
        { status: 409 },
      );
    }

    const pdf = await buildEvaluationPdf(evaluation.result, {
      id: evaluation.id,
      createdAt: evaluation.createdAt,
      audit: evaluation.audit,
      rubricVersion: evaluation.rubricVersion,
      modelName: evaluation.modelName,
      clientName: evaluation.clientName,
      coachName: evaluation.coachName,
      clientDetails: evaluation.clientDetails,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="evaluation-${id}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: publicErrorMessage(err) },
      { status: 500 },
    );
  }
}
