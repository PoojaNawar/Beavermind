import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

export type AiProviderId = "openai" | "groq";

export interface EvaluationModel {
  provider: AiProviderId;
  modelName: string;
  model: ReturnType<ReturnType<typeof createOpenAI>>;
}

/**
 * Resolve the configured model. Keys stay in this module — the pipeline
 * asks for an evaluation model, not provider branching.
 */
export function getEvaluationModel(): EvaluationModel {
  const provider = env.aiProvider();
  const modelName = env.aiModel();

  if (provider === "openai") {
    const apiKey = env.openaiKey();
    if (!apiKey || apiKey === "YOUR_MODEL_API_KEY") {
      throw new Error("OpenAI API key is not set.");
    }
    return {
      provider: "openai",
      modelName,
      model: openai(modelName, {
        structuredOutputs: true,
      }),
    };
  }

  if (provider === "groq") {
    const apiKey = env.groqKey();
    if (!apiKey || apiKey === "YOUR_MODEL_API_KEY") {
      throw new Error("Groq API key is not set.");
    }
    const groq = createOpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    return { provider: "groq", modelName, model: groq(modelName) };
  }

  throw new Error(
    `Unsupported AI_PROVIDER="${provider}". Use "openai" or "groq".`,
  );
}
