import { generateObject } from "ai";
import { z } from "zod";
import { getRubric } from "@/lib/rubrics";
import type { CallType, EvaluationResult, ProcessingPath } from "@/lib/rubrics/types";
import {
  modelDimensionSchema,
  modelEvaluationSchema,
  validateModelOutput,
  type ModelEvaluationOutput,
} from "@/lib/validation/schemas";
import { applyCapsAndBuildResult } from "@/lib/scoring/calculate";
import { resolveFiredCapIds } from "@/lib/scoring/detectCaps";
import { chunkTranscript, needsChunking } from "@/lib/transcripts/handling";
import { verifyEvidenceItems } from "@/lib/transcripts/evidenceQuality";
import { reconcileModelOutputAfterVerification } from "@/lib/transcripts/evidencePolicy";
import {
  aggregateEvidencePacks,
  chunkEvidencePackSchema,
  formatAggregatedEvidence,
  type ChunkEvidencePack,
} from "@/lib/ai/aggregateEvidence";
import {
  pauseBetweenProviderCalls,
  withProviderRetry,
} from "@/lib/ai/providerRetry";
import { getEvaluationModel } from "@/lib/ai/provider";
import {
  repairJsonText,
  structuredMaxTokens,
  structuredObjectMode,
} from "@/lib/ai/structuredOutput";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import type { EvaluationStage } from "@/lib/pipeline/stages";
import {
  buildEvidenceExtractionPrompt,
  buildSystemPrompt,
  buildUserEvaluationPrompt,
} from "./prompts";

const sixDimensionBatchSchema = z.object({
  dimensions: z.array(modelDimensionSchema).length(6),
});

const sixDimensionSummaryBatchSchema = z.object({
  dimensions: z.array(modelDimensionSchema).length(6),
  oneThing: modelEvaluationSchema.shape.oneThing,
  brief: modelEvaluationSchema.shape.brief,
  redFlags: modelEvaluationSchema.shape.redFlags,
  firedCapIds: modelEvaluationSchema.shape.firedCapIds,
  notes: modelEvaluationSchema.shape.notes,
});

export interface EvaluationRunStats {
  processingPath: ProcessingPath;
  chunkCount: number;
  modelCallCount: number;
  provider: string;
  modelName: string;
  pipelineVersion: string;
}

export type StageListener = (stage: EvaluationStage) => Promise<void>;

interface RunContext {
  onStage?: StageListener;
  modelCallCount: number;
}

async function callModel<T>(
  ctx: RunContext,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  ctx.modelCallCount += 1;
  return withProviderRetry(label, fn);
}

async function emit(ctx: RunContext, stage: EvaluationStage): Promise<void> {
  await ctx.onStage?.(stage);
}

function prepareVerifiedModel(args: {
  model: ModelEvaluationOutput;
  rubric: ReturnType<typeof getRubric>;
  transcript: string;
}): ModelEvaluationOutput {
  const validated = validateModelOutput(args.model, args.rubric);

  const withVerifiedEvidence: ModelEvaluationOutput = {
    ...validated,
    dimensions: validated.dimensions.map((d) => ({
      ...d,
      evidence: verifyEvidenceItems(d.evidence, args.transcript),
    })),
  };

  const reconciled =
    reconcileModelOutputAfterVerification(withVerifiedEvidence);

  reconciled.firedCapIds = resolveFiredCapIds({
    callType: args.rubric.id,
    transcript: args.transcript,
    modelFiredIds: reconciled.firedCapIds,
  });

  return reconciled;
}

async function runStructuredEvaluation(args: {
  callType: CallType;
  transcript: string;
  mode: "single" | "synthesis";
  evidencePack?: string;
  ctx: RunContext;
}): Promise<{ output: ModelEvaluationOutput; modelName: string }> {
  const rubric = getRubric(args.callType);
  const { model, modelName, provider } = getEvaluationModel();
  const system = buildSystemPrompt(
    rubric,
    args.mode === "synthesis" ? "synthesis" : "evaluation",
  );
  const result = await callModel(args.ctx, `eval:${args.callType}:${args.mode}`, () =>
    generateObject({
      model,
      schema: modelEvaluationSchema,
      mode: structuredObjectMode(provider),
      system,
      prompt: buildUserEvaluationPrompt({
        transcript: args.transcript,
        mode: args.mode,
        evidencePack: args.evidencePack,
      }),
      temperature: 0.2,
      maxTokens: structuredMaxTokens({
        provider,
        modelName,
        kind: "single",
      }),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(240_000),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  return { output: result.object, modelName };
}

/**
 * Split synthesis (dims 1–6, then 7–12 + summary) so structured JSON fits
 * practical completion-token budgets on a single response.
 */
async function runSplitSynthesisEvaluation(args: {
  callType: CallType;
  transcript: string;
  evidencePack: string;
  ctx: RunContext;
}): Promise<{ output: ModelEvaluationOutput; modelName: string }> {
  const rubric = getRubric(args.callType);
  const { model, modelName, provider } = getEvaluationModel();
  const system = buildSystemPrompt(rubric, "synthesis");
  const dimIds = rubric.dimensions.map((d) => d.id);
  const firstIds = dimIds.slice(0, 6);
  const secondIds = dimIds.slice(6);

  const first = await callModel(args.ctx, `synthesis:${args.callType}:dims1-6`, () =>
    generateObject({
      model,
      schema: sixDimensionBatchSchema,
      mode: structuredObjectMode(provider),
      system,
      prompt: buildUserEvaluationPrompt({
        transcript: args.transcript,
        mode: "synthesis",
        evidencePack: args.evidencePack,
        dimensionIds: firstIds,
        includeSummaryFields: false,
      }),
      temperature: 0.2,
      maxTokens: structuredMaxTokens({
        provider,
        modelName,
        kind: "synthesis",
      }),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(240_000),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  await pauseBetweenProviderCalls();

  const second = await callModel(args.ctx, `synthesis:${args.callType}:dims7-12`, () =>
    generateObject({
      model,
      schema: sixDimensionSummaryBatchSchema,
      mode: structuredObjectMode(provider),
      system,
      prompt: buildUserEvaluationPrompt({
        transcript: args.transcript,
        mode: "synthesis",
        evidencePack: args.evidencePack,
        dimensionIds: secondIds,
        includeSummaryFields: true,
      }),
      temperature: 0.2,
      maxTokens: structuredMaxTokens({
        provider,
        modelName,
        kind: "synthesis",
      }),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(240_000),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  const merged: ModelEvaluationOutput = {
    dimensions: [...first.object.dimensions, ...second.object.dimensions],
    oneThing: second.object.oneThing,
    brief: second.object.brief,
    redFlags: second.object.redFlags,
    firedCapIds: second.object.firedCapIds,
    notes: second.object.notes,
  };

  return { output: merged, modelName };
}

async function extractEvidencePacks(
  callType: CallType,
  transcript: string,
  ctx: RunContext,
): Promise<{ packs: ChunkEvidencePack[]; chunkCount: number }> {
  const rubric = getRubric(callType);
  const { model, provider, modelName } = getEvaluationModel();
  const system = buildSystemPrompt(rubric, "extraction");
  const chunks = chunkTranscript(transcript);
  const packs: ChunkEvidencePack[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (i > 0) await pauseBetweenProviderCalls();

    const { object } = await callModel(
      ctx,
      `extract:${callType}:chunk${chunk.index}`,
      () =>
        generateObject({
          model,
          schema: chunkEvidencePackSchema,
          mode: structuredObjectMode(provider),
          system,
          prompt: buildEvidenceExtractionPrompt({
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            chunkCount: chunks.length,
          }),
          temperature: 0.1,
          maxTokens: structuredMaxTokens({
            provider,
            modelName,
            kind: "extract",
          }),
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(120_000),
          experimental_repairText: async ({ text }) => repairJsonText(text),
        }),
    );

    packs.push(object);
  }

  return { packs, chunkCount: chunks.length };
}

/**
 * Main evaluation entry point (Option C′).
 * Provider/model from getEvaluationModel; map-reduce when needsChunking.
 *
 * AI proposes dimension scores and evidence. Backend verifies quotes,
 * applies caps, and computes totals/grade.
 */
export async function evaluateCall(args: {
  callType: CallType;
  transcript: string;
  onStage?: StageListener;
}): Promise<{ result: EvaluationResult; stats: EvaluationRunStats }> {
  const transcript = args.transcript.trim();
  const ctx: RunContext = { onStage: args.onStage, modelCallCount: 0 };
  const { provider, modelName } = getEvaluationModel();
  const chunked = needsChunking(transcript, args.callType);

  let modelOutput: ModelEvaluationOutput;
  let modelNameUsed: string;
  let chunkCount = 0;

  if (chunked) {
    await emit(ctx, "extracting_evidence");
    const extracted = await extractEvidencePacks(args.callType, transcript, ctx);
    chunkCount = extracted.chunkCount;

    await emit(ctx, "aggregating_evidence");
    const aggregated = aggregateEvidencePacks(extracted.packs, 2);
    const evidencePack = formatAggregatedEvidence(aggregated);

    await pauseBetweenProviderCalls();
    await emit(ctx, "evaluating");
    const synth = await runSplitSynthesisEvaluation({
      callType: args.callType,
      transcript,
      evidencePack,
      ctx,
    });
    modelOutput = synth.output;
    modelNameUsed = synth.modelName;
  } else {
    await emit(ctx, "evaluating");
    const single = await runStructuredEvaluation({
      callType: args.callType,
      transcript,
      mode: "single",
      ctx,
    });
    modelOutput = single.output;
    modelNameUsed = single.modelName;
  }

  await emit(ctx, "validating");
  const verified = prepareVerifiedModel({
    model: modelOutput,
    rubric: getRubric(args.callType),
    transcript,
  });
  await emit(ctx, "scoring");
  const result = applyCapsAndBuildResult({
    model: verified,
    rubric: getRubric(args.callType),
    modelName: modelNameUsed,
  });

  return {
    result,
    stats: {
      processingPath: chunked ? "chunked" : "single",
      chunkCount: chunked ? chunkCount : 1,
      modelCallCount: ctx.modelCallCount,
      provider,
      modelName,
      pipelineVersion: PIPELINE_VERSION,
    },
  };
}
