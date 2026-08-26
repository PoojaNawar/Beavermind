import { NextResponse } from "next/server";
import { after } from "next/server";
import { createEvaluationBodySchema } from "@/lib/validation/schemas";
import { validateTranscriptLength } from "@/lib/transcripts/handling";
import { getRubric, isCallType } from "@/lib/rubrics";
import { createEvaluation, listEvaluations } from "@/lib/db/evaluations";
import { processEvaluation } from "@/lib/pipeline/processEvaluation";
import {
  publicErrorMessage,
  sanitizeDiagnostic,
} from "@/lib/errors/evaluationError";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

function appUrl(request: Request): string {
  const configured = env.appUrl();
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function parseJsonBody(rawBody: string): unknown {
  if (!rawBody.trim()) {
    throw new Error("Empty request body.");
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(
      "Invalid JSON body. Ensure the transcript is sent as a JSON string field.",
    );
  }
}

export async function GET() {
  try {
    const evaluations = await listEvaluations();
    return NextResponse.json({ evaluations });
  } catch (err) {
    console.warn(`[evaluations GET] ${sanitizeDiagnostic(err)}`);
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = parseJsonBody(rawBody);
    const parsed = createEvaluationBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 },
      );
    }

    const { callType, transcript, clientName, coachName, clientDetails } =
      parsed.data;

    if (!isCallType(callType)) {
      return NextResponse.json({ error: "Invalid call type." }, { status: 400 });
    }

    const lengthCheck = validateTranscriptLength(transcript);
    if (!lengthCheck.ok) {
      return NextResponse.json({ error: lengthCheck.error }, { status: 400 });
    }

    const rubric = getRubric(callType);
    const evaluation = await createEvaluation({
      callType,
      transcript: transcript.trim(),
      rubricVersion: rubric.version,
      clientName,
      coachName,
      clientDetails,
    });

    const publicBase = appUrl(request);
    const origin = new URL(request.url).origin;
    const processUrl = `${origin}/api/evaluations/${evaluation.id}/process`;

    if (process.env.VERCEL) {
      after(() => {
        void fetch(processUrl, { method: "POST" }).catch(() => {
          /* report page also POSTs /process */
        });
      });
    } else {
      after(async () => {
        await processEvaluation(evaluation.id);
      });
    }

    return NextResponse.json(
      {
        id: evaluation.id,
        status: evaluation.status,
        stage: evaluation.stage,
        url: `${publicBase}/evaluations/${evaluation.id}`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.warn(`[evaluations POST] ${sanitizeDiagnostic(err)}`);
    if (rawLooksLikeClientError(err)) {
      const message = err instanceof Error ? err.message : "Invalid request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: publicErrorMessage(err) }, { status: 500 });
  }
}

function rawLooksLikeClientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return message.includes("JSON") || message.includes("Empty request");
}
