import { NextResponse } from "next/server";
import { getEvaluation, toClientEvaluation } from "@/lib/db/evaluations";
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

    return NextResponse.json(toClientEvaluation(evaluation));
  } catch (err) {
    return NextResponse.json(
      { error: publicErrorMessage(err) },
      { status: 500 },
    );
  }
}
