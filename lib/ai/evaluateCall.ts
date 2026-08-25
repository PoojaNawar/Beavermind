import { generateObject } from "ai";
import { z } from "zod";
import { getRubric } from "@/lib/rubrics";
import type { CallType, EvaluationResult, ProcessingPath } from "@/lib/rubrics/types";
import {
  modelDimensionSchema,
  modelEvaluationSchema,
  validateModelOutput,
  type ModelDimensionOutput,
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
  isOpenAiReasoningModel,
  modelCallTimeoutMs,
  repairJsonText,
  structuredMaxTokens,
  structuredObjectMode,
} from "@/lib/ai/structuredOutput";
import { PIPELINE_VERSION } from "@/lib/pipeline/version";
import type { EvaluationStage } from "@/lib/pipeline/stages";
import {
  type PipelineCheckpoint,
  isPipelineCheckpoint,
} from "@/lib/pipeline/checkpoint";
import { env } from "@/lib/env";
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
export type ProgressListener = (message: string) => Promise<void>;

export type EvaluateCallOutcome =
  | { done: true; result: EvaluationResult; stats: EvaluationRunStats }
  | {
      done: false;
      checkpoint: PipelineCheckpoint;
      stats: EvaluationRunStats;
    };

export { isPipelineCheckpoint };

interface RunContext {
  onStage?: StageListener;
  onProgress?: ProgressListener;
  modelCallCount: number;
  provider: "openai" | "groq";
}

async function callModel<T>(
  ctx: RunContext,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  ctx.modelCallCount += 1;
  return withProviderRetry(
    label,
    fn,
    ctx.provider === "openai"
      ? { maxAttempts: 2, baseDelayMs: 1000 }
      : undefined,
  );
}

async function emit(ctx: RunContext, stage: EvaluationStage): Promise<void> {
  await ctx.onStage?.(stage);
}

async function announce(ctx: RunContext, message: string): Promise<void> {
  await ctx.onProgress?.(message);
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
      abortSignal: AbortSignal.timeout(
        modelCallTimeoutMs({
          provider,
          modelName,
          kind: args.mode === "synthesis" ? "synthesis" : "single",
        }),
      ),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  return { output: result.object, modelName };
}

async function runSynthesisFirstBatch(args: {
  callType: CallType;
  evidencePack: string;
  ctx: RunContext;
}): Promise<{ dimensions: ModelDimensionOutput[]; modelName: string }> {
  const rubric = getRubric(args.callType);
  const { model, modelName, provider } = getEvaluationModel();
  const system = buildSystemPrompt(rubric, "synthesis");
  const firstIds = rubric.dimensions.map((d) => d.id).slice(0, 6);

  const first = await callModel(args.ctx, `synthesis:${args.callType}:dims1-6`, () =>
    generateObject({
      model,
      schema: sixDimensionBatchSchema,
      mode: structuredObjectMode(provider),
      system,
      prompt: buildUserEvaluationPrompt({
        transcript: "",
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
      abortSignal: AbortSignal.timeout(
        modelCallTimeoutMs({ provider, modelName, kind: "synthesis" }),
      ),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  return { dimensions: first.object.dimensions, modelName };
}

async function runSynthesisSecondBatch(args: {
  callType: CallType;
  evidencePack: string;
  ctx: RunContext;
}): Promise<{ output: Omit<ModelEvaluationOutput, "dimensions"> & { dimensions: ModelDimensionOutput[] }; modelName: string }> {
  const rubric = getRubric(args.callType);
  const { model, modelName, provider } = getEvaluationModel();
  const system = buildSystemPrompt(rubric, "synthesis");
  const secondIds = rubric.dimensions.map((d) => d.id).slice(6);

  const second = await callModel(args.ctx, `synthesis:${args.callType}:dims7-12`, () =>
    generateObject({
      model,
      schema: sixDimensionSummaryBatchSchema,
      mode: structuredObjectMode(provider),
      system,
      prompt: buildUserEvaluationPrompt({
        transcript: "",
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
      abortSignal: AbortSignal.timeout(
        modelCallTimeoutMs({ provider, modelName, kind: "synthesis" }),
      ),
      experimental_repairText: async ({ text }) => repairJsonText(text),
    }),
  );

  return { output: second.object, modelName };
}

async function extractOneChunk(args: {
  callType: CallType;
  chunkText: string;
  chunkIndex: number;
  chunkCount: number;
  ctx: RunContext;
}): Promise<ChunkEvidencePack> {
  const rubric = getRubric(args.callType);
  const { model, provider, modelName } = getEvaluationModel();
  const system = buildSystemPrompt(rubric, "extraction");

  const { object } = await callModel(
    args.ctx,
    `extract:${args.callType}:chunk${args.chunkIndex}`,
    () =>
      generateObject({
        model,
        schema: chunkEvidencePackSchema,
        mode: structuredObjectMode(provider),
        system,
        prompt: buildEvidenceExtractionPrompt({
          chunkText: args.chunkText,
          chunkIndex: args.chunkIndex,
          chunkCount: args.chunkCount,
        }),
        temperature: 0.1,
        maxTokens: structuredMaxTokens({
          provider,
          modelName,
          kind: "extract",
        }),
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(
          modelCallTimeoutMs({ provider, modelName, kind: "extract" }),
        ),
        experimental_repairText: async ({ text }) => repairJsonText(text),
      }),
  );

  return object;
}

function runStats(args: {
  chunked: boolean;
  chunkCount: number;
  modelCallCount: number;
  provider: string;
  modelName: string;
}): EvaluationRunStats {
  return {
    processingPath: args.chunked ? "chunked" : "single",
    chunkCount: args.chunked ? args.chunkCount : 1,
    modelCallCount: args.modelCallCount,
    provider: args.provider,
    modelName: args.modelName,
    pipelineVersion: PIPELINE_VERSION,
  };
}

function unfinished(args: {
  checkpoint: PipelineCheckpoint;
  provider: string;
  modelName: string;
}): EvaluateCallOutcome {
  return {
    done: false,
    checkpoint: args.checkpoint,
    stats: runStats({
      chunked: true,
      chunkCount: args.checkpoint.chunkCount,
      modelCallCount: args.checkpoint.modelCallCount,
      provider: args.provider,
      modelName: args.modelName,
    }),
  };
}

/**
 * Main evaluation entry point (Option C′).
 * Provider/model from getEvaluationModel; map-reduce when needsChunking.
 *
 * On Vercel, one pipeline phase per invocation: all extract chunks in
 * parallel, then each synthesis half. Scoring/rubric semantics unchanged.
 */
export async function evaluateCall(args: {
  callType: CallType;
  transcript: string;
  onStage?: StageListener;
  onProgress?: ProgressListener;
  checkpoint?: PipelineCheckpoint | null;
  stepMode?: "full" | "phase";
}): Promise<EvaluateCallOutcome> {
  const transcript = args.transcript.trim();
  const saved = args.checkpoint;
  let lastProgress = saved?.progress;
  const { provider, modelName } = getEvaluationModel();
  const ctx: RunContext = {
    onStage: args.onStage,
    onProgress: async (message) => {
      lastProgress = message;
      await args.onProgress?.(message);
    },
    modelCallCount: saved?.modelCallCount ?? 0,
    provider,
  };
  const chunked = needsChunking(transcript, args.callType);
  const stopAfterPhase =
    (args.stepMode ?? env.pipelineStepMode()) === "phase";

  const finish = async (
    modelOutput: ModelEvaluationOutput,
    modelNameUsed: string,
    chunkCount: number,
  ): Promise<EvaluateCallOutcome> => {
    await emit(ctx, "validating");
    await announce(ctx, "Checking quotes against the original transcript");
    const verified = prepareVerifiedModel({
      model: modelOutput,
      rubric: getRubric(args.callType),
      transcript,
    });
    await emit(ctx, "scoring");
    await announce(ctx, "Calculating the overall score");
    const result = applyCapsAndBuildResult({
      model: verified,
      rubric: getRubric(args.callType),
      modelName: modelNameUsed,
    });
    return {
      done: true,
      result,
      stats: runStats({
        chunked,
        chunkCount,
        modelCallCount: ctx.modelCallCount,
        provider,
        modelName,
      }),
    };
  };

  if (!chunked) {
    await emit(ctx, "evaluating");
    await announce(ctx, "Scoring the full call against the rubric");
    const single = await runStructuredEvaluation({
      callType: args.callType,
      transcript,
      mode: "single",
      ctx,
    });
    return finish(single.output, single.modelName, 1);
  }

  const chunks = chunkTranscript(transcript);
  let phase = saved?.phase ?? "extract";
  let packs: ChunkEvidencePack[] = saved?.packs ? [...saved.packs] : [];
  let nextChunkIndex = saved?.nextChunkIndex ?? 0;
  let firstDimensions = saved?.firstDimensions;

  const snapshot = (
    nextPhase: PipelineCheckpoint["phase"],
    extra?: Pick<PipelineCheckpoint, "firstDimensions">,
  ): PipelineCheckpoint => ({
    kind: "beavermind_checkpoint",
    version: 1,
    phase: nextPhase,
    packs,
    nextChunkIndex,
    chunkCount: chunks.length,
    modelCallCount: ctx.modelCallCount,
    firstDimensions: extra?.firstDimensions ?? firstDimensions,
    progress: lastProgress,
  });

  if (phase === "extract") {
    await emit(ctx, "extracting_evidence");
    const remaining = chunks.slice(nextChunkIndex);
    if (remaining.length > 0) {
      await announce(
        ctx,
        remaining.length === 1
          ? "Extracting evidence from the transcript"
          : `Extracting evidence from ${remaining.length} transcript chunks`,
      );
      let extractedCount = nextChunkIndex;
      if (provider === "openai") {
        const extracted = await Promise.all(
          remaining.map(async (chunk) => {
            const pack = await extractOneChunk({
              callType: args.callType,
              chunkText: chunk.text,
              chunkIndex: chunk.index,
              chunkCount: chunks.length,
              ctx,
            });
            extractedCount += 1;
            await announce(
              ctx,
              `Extracted evidence from ${extractedCount} of ${chunks.length} chunks`,
            );
            return pack;
          }),
        );
        extracted.sort((a, b) => a.chunkIndex - b.chunkIndex);
        packs.push(...extracted);
      } else {
        for (let i = 0; i < remaining.length; i++) {
          if (i > 0) await pauseBetweenProviderCalls();
          const chunk = remaining[i]!;
          packs.push(
            await extractOneChunk({
              callType: args.callType,
              chunkText: chunk.text,
              chunkIndex: chunk.index,
              chunkCount: chunks.length,
              ctx,
            }),
          );
          await announce(
            ctx,
            `Extracted evidence from ${nextChunkIndex + i + 1} of ${chunks.length} chunks`,
          );
        }
      }
      nextChunkIndex = chunks.length;
    }
    phase = "synthesis_first";
    if (stopAfterPhase) {
      return unfinished({
        checkpoint: snapshot("synthesis_first"),
        provider,
        modelName,
      });
    }
  }

  const aggregated = aggregateEvidencePacks(packs, 2);
  const evidencePack = formatAggregatedEvidence(aggregated);

  if (phase === "synthesis_first") {
    await emit(ctx, "aggregating_evidence");
    await announce(ctx, "Combining quotes from every chunk");
    if (provider !== "openai") await pauseBetweenProviderCalls();
    await emit(ctx, "evaluating");

    if (!isOpenAiReasoningModel(provider, modelName)) {
      await announce(ctx, "Scoring all 12 dimensions against the rubric");
      const synth = await runStructuredEvaluation({
        callType: args.callType,
        transcript: "",
        mode: "synthesis",
        evidencePack,
        ctx,
      });
      return finish(synth.output, synth.modelName, chunks.length);
    }

    await announce(ctx, "Scoring dimensions 1–6");
    const first = await runSynthesisFirstBatch({
      callType: args.callType,
      evidencePack,
      ctx,
    });
    firstDimensions = first.dimensions;
    phase = "synthesis_second";
    if (stopAfterPhase) {
      return unfinished({
        checkpoint: snapshot("synthesis_second", {
          firstDimensions,
        }),
        provider,
        modelName,
      });
    }
  }

  if (!firstDimensions || firstDimensions.length !== 6) {
    throw new Error("Invalid JSON: synthesis checkpoint missing first dimension batch.");
  }

  if (provider !== "openai") await pauseBetweenProviderCalls();
  await emit(ctx, "evaluating");
  await announce(ctx, "Scoring dimensions 7–12 and writing the summary");
  const second = await runSynthesisSecondBatch({
    callType: args.callType,
    evidencePack,
    ctx,
  });

  const merged: ModelEvaluationOutput = {
    dimensions: [...firstDimensions, ...second.output.dimensions],
    oneThing: second.output.oneThing,
    brief: second.output.brief,
    redFlags: second.output.redFlags,
    firedCapIds: second.output.firedCapIds,
    notes: second.output.notes,
  };

  return finish(merged, second.modelName, chunks.length);
}
