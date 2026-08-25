import {
  DEFAULT_MAX_TRANSCRIPT_CHARS,
  DEFAULT_SINGLE_PASS_CHARS,
} from "@/lib/transcripts/thresholds";

function first(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export const env = {
  openaiKey: () => first("OPENAI_API_KEY", "MODEL_API_KEY"),
  /** @deprecated Prefer openaiKey — kept for older env files during migration */
  groqKey: () => first("GROQ_KEY", "MODEL_API_KEY"),
  aiProvider: () => (first("AI_PROVIDER") ?? "openai").toLowerCase(),
  aiModel: () => first("AI_MODEL") ?? "gpt-5-mini",
  supabaseUrl: () => first("SUPABASE_URL"),
  supabaseAnon: () => first("SUPABASE_ANON", "SUPABASE_ANON_KEY"),
  supabaseSecret: () =>
    first("SUPABASE_SECRET", "SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => first("APP_URL", "NEXT_PUBLIC_APP_URL"),
  /**
   * Hosting step mode. Vercel runs one pipeline phase per invocation
   * (all extract chunks in parallel, then each synthesis half).
   */
  pipelineStepMode: (): "full" | "phase" => {
    const raw = first("PIPELINE_STEP_MODEL_CALLS");
    if (raw === "all") return "full";
    if (raw === "phase") return "phase";
    if (process.env.VERCEL) return "phase";
    return "full";
  },
  maxChars: () =>
    Number(
      first("MAX_CHARS", "MAX_TRANSCRIPT_CHARS") ??
        DEFAULT_MAX_TRANSCRIPT_CHARS,
    ),
  /** Single-pass character gate — same default as lib/transcripts/thresholds. */
  chunkAt: () =>
    Number(
      first("CHUNK_AT", "SINGLE_PASS_TRANSCRIPT_CHARS") ??
        DEFAULT_SINGLE_PASS_CHARS,
    ),
};
