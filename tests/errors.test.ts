import { describe, expect, it } from "vitest";
import {
  classifyEvaluationError,
  publicErrorMessage,
  sanitizeDiagnostic,
} from "@/lib/errors/evaluationError";

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
    expect(publicErrorMessage(new Error("ETIMEDOUT"))).toMatch(/unavailable/i);
  });

  it("does not leak Zod or SQL details to the user", () => {
    expect(
      publicErrorMessage(new Error("Database error updating evaluation: relation foo")),
    ).not.toMatch(/relation foo/);
    expect(
      publicErrorMessage(new Error("Unknown dimension id from model: d99")),
    ).toBe("Evaluation could not be completed. Please retry.");
  });
});
