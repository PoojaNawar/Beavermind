/**
 * Single source of truth for transcript routing / chunking limits.
 *
 * WHY these values exist:
 * - Single-pass is only safe when compact rubric + transcript fit comfortably
 *   in one model request (structured-output schemas also consume budget).
 * - Larger transcripts use map-reduce so each call stays within practical
 *   input/output limits across providers (historically driven by low TPM tiers).
 * - Chunk size is smaller than the single-pass char gate so each extract call
 *   leaves headroom for rubric + schema + completion tokens.
 *
 * Override via env: CHUNK_AT / SINGLE_PASS_TRANSCRIPT_CHARS, MAX_CHARS / MAX_TRANSCRIPT_CHARS.
 */

/** Absolute API reject ceiling for pasted transcripts. */
export const DEFAULT_MAX_TRANSCRIPT_CHARS = 100_000;

/**
 * Char gate for single-pass vs map-reduce.
 * Below this length we *may* still chunk if the token estimate exceeds TPM_SAFE_INPUT_TOKENS.
 */
export const DEFAULT_SINGLE_PASS_CHARS = 12_000;

/** Target size per speaker-turn chunk during map-reduce. */
export const CHUNK_TARGET_CHARS = 8_000;

/** Overlap speaker turns between adjacent chunks to preserve context at boundaries. */
export const CHUNK_OVERLAP_TURNS = 4;

/**
 * Soft input-token budget for a single evaluation call.
 * Keeps single-pass prompts from ballooning past practical provider limits.
 */
export const TPM_SAFE_INPUT_TOKENS = 5_500;

/** Approximate tokens reserved for system instructions + schema overhead. */
export const PROMPT_OVERHEAD_TOKENS = 900;
