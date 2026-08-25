import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  chunkTranscript,
  needsChunking,
  parseTurns,
  quoteExistsInTranscript,
  validateTranscriptLength,
} from "@/lib/transcripts/handling";
import { buildCompactRubricSection } from "@/lib/ai/prompts";
import { getKickoffRubric } from "@/lib/rubrics/kickoff";

const kickoff01 = readFileSync(
  path.join(process.cwd(), "transcripts/kickoff-01.txt"),
  "utf8",
);
const coaching02 = readFileSync(
  path.join(process.cwd(), "transcripts/coaching-02.txt"),
  "utf8",
);

describe("transcript handling", () => {
  it("parses a normal Halden-format transcript", () => {
    const turns = parseTurns(kickoff01);
    expect(turns.length).toBeGreaterThan(20);
    expect(turns[0]!.speaker).toBe("Dana Whitlock");
    expect(turns[1]!.speaker).toBe("Owen Brandt");
  });

  it("rejects an empty transcript", () => {
    expect(validateTranscriptLength("").ok).toBe(false);
    expect(validateTranscriptLength("   \n").ok).toBe(false);
  });

  it("rejects transcripts over the max character limit", () => {
    const original = process.env.MAX_TRANSCRIPT_CHARS;
    process.env.MAX_TRANSCRIPT_CHARS = "100";
    const result = validateTranscriptLength("x".repeat(101));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/);
    if (original === undefined) delete process.env.MAX_TRANSCRIPT_CHARS;
    else process.env.MAX_TRANSCRIPT_CHARS = original;
  });

  it("accepts the supplied long coaching transcript", () => {
    expect(validateTranscriptLength(coaching02).ok).toBe(true);
    expect(coaching02.length).toBeGreaterThan(60_000);
  });

  it("chunks long transcripts on speaker-turn boundaries", () => {
    const chunks = chunkTranscript(coaching02);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.text.startsWith("[")).toBe(true);
  });

  it("flags transcripts above the single-pass threshold for chunking on Groq", () => {
    const provider = process.env.AI_PROVIDER;
    const original = process.env.SINGLE_PASS_TRANSCRIPT_CHARS;
    process.env.AI_PROVIDER = "groq";
    process.env.SINGLE_PASS_TRANSCRIPT_CHARS = "1000";
    expect(needsChunking("a".repeat(1001))).toBe(true);
    expect(needsChunking("short")).toBe(false);
    if (original === undefined) delete process.env.SINGLE_PASS_TRANSCRIPT_CHARS;
    else process.env.SINGLE_PASS_TRANSCRIPT_CHARS = original;
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
  });

  it("keeps OpenAI on a single model call for exercise-length transcripts", () => {
    const provider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "openai";
    expect(needsChunking(kickoff01, "kickoff")).toBe(false);
    expect(needsChunking(coaching02, "coaching")).toBe(false);
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
  });

  it("flags exercise transcripts for chunked path on Groq", () => {
    const provider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "groq";
    expect(needsChunking(kickoff01, "kickoff")).toBe(true);
    expect(needsChunking(coaching02, "coaching")).toBe(true);
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
  });

  it("compact rubric prompt excludes full markdown source", () => {
    const rubric = getKickoffRubric();
    const section = buildCompactRubricSection(rubric);
    expect(section).toContain("DIMENSIONS:");
    expect(section).toContain("d1:");
    expect(section).not.toContain("FULL RUBRIC DOCUMENT");
    expect(section.length).toBeLessThan(rubric.sourceMarkdown.length);
  });

  it("verifies quotes against the transcript and rejects fabrications", () => {
    expect(
      quoteExistsInTranscript(
        "you do not need to repeat all of that for me",
        kickoff01,
      ),
    ).toBe(true);
    expect(
      quoteExistsInTranscript(
        "The coach definitely booked a Hawaiian vacation together",
        kickoff01,
      ),
    ).toBe(false);
  });
});
