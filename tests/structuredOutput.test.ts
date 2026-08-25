import { describe, expect, it } from "vitest";
import {
  isOpenAiReasoningModel,
  modelCallTimeoutMs,
  repairJsonText,
  structuredMaxTokens,
  structuredObjectMode,
} from "@/lib/ai/structuredOutput";
import { evidenceItemSchema } from "@/lib/validation/schemas";

describe("OpenAI structured output helpers", () => {
  it("treats gpt-5-mini as an OpenAI reasoning model", () => {
    expect(isOpenAiReasoningModel("openai", "gpt-5-mini")).toBe(true);
    expect(isOpenAiReasoningModel("groq", "gpt-5-mini")).toBe(false);
    expect(isOpenAiReasoningModel("openai", "gpt-4o-mini")).toBe(false);
  });

  it("does not cap completion tokens for OpenAI reasoning models", () => {
    expect(
      structuredMaxTokens({
        provider: "openai",
        modelName: "gpt-5-mini",
        kind: "extract",
      }),
    ).toBeUndefined();
    expect(
      structuredMaxTokens({
        provider: "openai",
        modelName: "gpt-4o-mini",
        kind: "extract",
      }),
    ).toBe(2048);
    expect(
      modelCallTimeoutMs({
        provider: "openai",
        modelName: "gpt-4o-mini",
        kind: "extract",
      }),
    ).toBe(45_000);
    expect(
      modelCallTimeoutMs({
        provider: "openai",
        modelName: "gpt-5-mini",
        kind: "extract",
      }),
    ).toBe(120_000);
  });

  it("uses json object mode for OpenAI and leaves Groq on auto/tool", () => {
    expect(structuredObjectMode("openai")).toBe("json");
    expect(structuredObjectMode("groq")).toBeUndefined();
  });

  it("repairs fenced or prose-wrapped JSON", () => {
    expect(repairJsonText('```json\n{"chunkIndex":1}\n```')).toBe(
      '{"chunkIndex":1}',
    );
    expect(repairJsonText('Here you go:\n{"ok":true}')).toBe('{"ok":true}');
    expect(repairJsonText("")).toBeNull();
  });

  it("does not put backend verificationStatus on the model evidence schema", () => {
    expect(Object.keys(evidenceItemSchema.shape)).not.toContain(
      "verificationStatus",
    );
  });
});
