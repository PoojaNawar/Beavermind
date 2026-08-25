import type { AiProviderId } from "@/lib/ai/provider";

/**
 * gpt-5 / o-series models spend completion budget on reasoning.
 * A tight maxTokens (e.g. 2048) often leaves empty or truncated JSON,
 * which generateObject reports as "could not parse the response."
 */
export function isOpenAiReasoningModel(
  provider: AiProviderId,
  modelName: string,
): boolean {
  if (provider !== "openai") return false;
  return modelName.startsWith("gpt-5") || /^o[1-4]/.test(modelName);
}

export function structuredObjectMode(
  provider: AiProviderId,
): "json" | undefined {
  return provider === "openai" ? "json" : undefined;
}

export function structuredMaxTokens(args: {
  provider: AiProviderId;
  modelName: string;
  kind: "extract" | "synthesis" | "single";
}): number | undefined {
  if (isOpenAiReasoningModel(args.provider, args.modelName)) {
    return undefined;
  }
  if (args.kind === "extract") return 2048;
  if (args.kind === "synthesis") return 2800;
  return 3800;
}

/** Wall-clock abort so a fast model cannot hang a Vercel invocation. */
export function modelCallTimeoutMs(args: {
  provider: AiProviderId;
  modelName: string;
  kind: "extract" | "synthesis" | "single";
}): number {
  if (isOpenAiReasoningModel(args.provider, args.modelName)) {
    return args.kind === "extract" ? 120_000 : 240_000;
  }
  if (args.kind === "extract") return 45_000;
  return 60_000;
}

/** Recover JSON when the model wraps it in fences or leading prose. */
export function repairJsonText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start > 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}
