import { describe, expect, it } from "vitest";
import {
  classifyEvaluationError,
  publicErrorMessage,
  sanitizeDiagnostic,
} from "@/lib/errors/evaluationError";
import { env } from "@/lib/env";

describe("safe evaluation errors", () => {
  it("does not expose API keys in public or diagnostic text", () => {
    const err = new Error("Invalid OPENAI_API_KEY sk-abcdefghijklmnopqrstuvwxyz");
    expect(publicErrorMessage(err)).not.toMatch(/sk-/);
    expect(publicErrorMessage(err)).not.toMatch(/OPENAI_API_KEY/);
    expect(sanitizeDiagnostic(err)).toMatch(/\[redacted\]/);
    expect(sanitizeDiagnostic(err)).not.toMatch(/sk-abcdefgh/);
  });

  it("maps rate limits and provider failures to safe copy", () => {
    expect(classifyEvaluationError(new Error("429 rate limit"))).toBe(
      "rate_limited",
    );
    expect(publicErrorMessage(new Error("429 rate limit"))).toMatch(
      /busy|retry/i,
    );
    expect(publicErrorMessage(new Error("OpenAI API key is not set."))).toMatch(
      /unavailable/i,
    );
    expect(publicErrorMessage(new Error("ETIMEDOUT"))).toMatch(/unavailable/i);
  });

  it("maps database failures including invalid API keys", () => {
    expect(classifyEvaluationError(new Error("Invalid API key"))).toBe(
      "database_error",
    );
    expect(publicErrorMessage(new Error("Invalid API key"))).toMatch(
      /could not be saved/i,
    );
    expect(
      publicErrorMessage(
        new Error("Database error creating evaluation: Could not find the 'client_name' column of 'evaluations' in the schema cache"),
      ),
    ).toMatch(/003_subject/i);
  });

  it("does not leak Zod or SQL details to the user", () => {
    expect(
      publicErrorMessage(new Error("Database error updating evaluation: relation foo")),
    ).not.toMatch(/relation foo/);
    expect(
      publicErrorMessage(new Error("Unknown dimension id from model: d99")),
    ).toBe("The evaluator returned a score the rubric could not accept. Please retry.");
    expect(
      publicErrorMessage(new Error("Unknown dimension id from model: d99")),
    ).not.toMatch(/d99/);
  });
});

describe("evaluation model routing", () => {
  it("does not use OpenAI reasoning models for live scoring", () => {
    const original = process.env.AI_MODEL;
    process.env.AI_MODEL = "gpt-5-mini";
    expect(env.aiModel()).toBe("gpt-4o-mini");
    if (original === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = original;
  });
});
