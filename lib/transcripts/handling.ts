import { buildCompactRubricSection } from "@/lib/ai/prompts";
import { getRubric } from "@/lib/rubrics";
import type { CallType } from "@/lib/rubrics/types";
import { env } from "@/lib/env";
import {
  CHUNK_OVERLAP_TURNS,
  CHUNK_TARGET_CHARS,
  DEFAULT_MAX_TRANSCRIPT_CHARS,
  DEFAULT_SINGLE_PASS_CHARS,
  PROMPT_OVERHEAD_TOKENS,
  TPM_SAFE_INPUT_TOKENS,
} from "@/lib/transcripts/thresholds";

export {
  normalizeForQuoteMatch,
  quoteExistsInTranscript,
} from "@/lib/transcripts/quoteMatch";

export {
  CHUNK_OVERLAP_TURNS,
  CHUNK_TARGET_CHARS,
  DEFAULT_MAX_TRANSCRIPT_CHARS,
  DEFAULT_SINGLE_PASS_CHARS,
  PROMPT_OVERHEAD_TOKENS,
  TPM_SAFE_INPUT_TOKENS,
} from "@/lib/transcripts/thresholds";

/**
 * Transcript routing for Option C′ map-reduce.
 *
 * Single-pass only when the full transcript + compact rubric fit a safe
 * request budget. Otherwise: overlapping speaker-turn chunks → evidence
 * extract → deterministic aggregate → split synthesis → quote verify.
 */

export interface TranscriptTurn {
  index: number;
  speaker: string;
  text: string;
  raw: string;
}

export interface TranscriptChunk {
  index: number;
  startTurn: number;
  endTurn: number;
  text: string;
  charCount: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function getLimits() {
  return {
    maxChars: env.maxChars() || DEFAULT_MAX_TRANSCRIPT_CHARS,
    singlePassChars: env.chunkAt() || DEFAULT_SINGLE_PASS_CHARS,
  };
}

export function compactRubricTokenEstimate(callType: CallType): number {
  const rubric = getRubric(callType);
  return estimateTokens(buildCompactRubricSection(rubric));
}

export function parseTurns(transcript: string): TranscriptTurn[] {
  const lines = transcript.replace(/\r\n/g, "\n").split("\n");
  const turns: TranscriptTurn[] = [];
  let index = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\[([^\]]+)\]:\s*(.*)$/);
    if (match) {
      turns.push({
        index,
        speaker: match[1]!.trim(),
        text: match[2] ?? "",
        raw: trimmed,
      });
      index += 1;
    } else if (turns.length > 0) {
      const prev = turns[turns.length - 1]!;
      prev.text = `${prev.text} ${trimmed}`.trim();
      prev.raw = `${prev.raw}\n${trimmed}`;
    } else {
      turns.push({
        index,
        speaker: "Unknown",
        text: trimmed,
        raw: trimmed,
      });
      index += 1;
    }
  }

  return turns;
}

export function chunkTranscript(transcript: string): TranscriptChunk[] {
  const turns = parseTurns(transcript);
  if (turns.length === 0) {
    return [
      {
        index: 0,
        startTurn: 0,
        endTurn: 0,
        text: transcript,
        charCount: transcript.length,
      },
    ];
  }

  const chunks: TranscriptChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < turns.length) {
    let end = start;
    let size = 0;
    while (end < turns.length && size < CHUNK_TARGET_CHARS) {
      size += turns[end]!.raw.length + 1;
      end += 1;
    }
    if (end === start) end = start + 1;

    const slice = turns.slice(start, end);
    const text = slice.map((t) => t.raw).join("\n");
    chunks.push({
      index: chunkIndex,
      startTurn: start,
      endTurn: end - 1,
      text,
      charCount: text.length,
    });
    chunkIndex += 1;

    if (end >= turns.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP_TURNS);
  }

  return chunks;
}

export function singlePassTokenEstimate(
  transcript: string,
  callType?: CallType,
): number {
  const rubricTokens = callType
    ? compactRubricTokenEstimate(callType)
    : 3500;
  return (
    rubricTokens + estimateTokens(transcript) + PROMPT_OVERHEAD_TOKENS
  );
}

export function needsChunking(
  transcript: string,
  callType?: CallType,
): boolean {
  const { singlePassChars } = getLimits();
  if (transcript.length > singlePassChars) return true;

  if (callType) {
    const estimated = singlePassTokenEstimate(transcript, callType);
    if (estimated > TPM_SAFE_INPUT_TOKENS) return true;
  } else {
    const estimated =
      estimateTokens(transcript) + 3500 + PROMPT_OVERHEAD_TOKENS;
    if (estimated > TPM_SAFE_INPUT_TOKENS) return true;
  }

  return false;
}

export function validateTranscriptLength(transcript: string): {
  ok: boolean;
  error?: string;
} {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { ok: false, error: "Transcript is empty." };
  }
  const { maxChars } = getLimits();
  if (trimmed.length > maxChars) {
    return {
      ok: false,
      error: `Transcript is too large (${trimmed.length.toLocaleString()} characters). Maximum is ${maxChars.toLocaleString()}.`,
    };
  }
  return { ok: true };
}
