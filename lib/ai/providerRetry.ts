import { sanitizeDiagnostic } from "@/lib/errors/evaluationError";

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 5000;
/** Cap wait so a bad retry-after cannot block a job for many minutes. */
const MAX_RETRY_DELAY_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getResponseHeaders(
  err: unknown,
): Record<string, string> | undefined {
  if (err && typeof err === "object" && "responseHeaders" in err) {
    return (err as { responseHeaders?: Record<string, string> })
      .responseHeaders;
  }
  return undefined;
}

function parseRetryAfterMs(err: unknown): number | null {
  const headers = getResponseHeaders(err);
  const headerVal = headers?.["retry-after"];
  if (headerVal) {
    const seconds = Number(headerVal);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000) + 1000;
    }
  }

  const message = errorMessage(err);
  const tryAgainMatch = message.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (tryAgainMatch) {
    return Math.ceil(Number(tryAgainMatch[1]) * 1000) + 1000;
  }

  const resetMatch = message.match(/reset-tokens[^0-9]*(\d+(?:\.\d+)?)\s*s/i);
  if (resetMatch) {
    return Math.ceil(Number(resetMatch[1]) * 1000) + 1000;
  }

  return null;
}

function isRetryableRateLimit(err: unknown): boolean {
  const message = errorMessage(err);
  if (
    /too large|requested \d+/i.test(message) &&
    /tpm|tokens per minute/i.test(message)
  ) {
    return false;
  }
  if (err && typeof err === "object") {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return true;
  }
  return /429|rate limit|rate_limit|tokens per minute \(tpm\)/i.test(message);
}

/**
 * Retry provider calls on rate limits using retry-after when available.
 * Does not spin on non-retryable errors (e.g. single request exceeds TPM).
 */
export async function withProviderRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableRateLimit(err) || attempt === maxAttempts) {
        throw err;
      }

      const retryAfterMs = parseRetryAfterMs(err);
      const rawDelayMs = retryAfterMs ?? baseDelayMs * attempt;
      const delayMs = Math.min(rawDelayMs, MAX_RETRY_DELAY_MS);

      console.warn(
        `[provider-retry] ${label} attempt ${attempt}/${maxAttempts}; waiting ${Math.round(delayMs / 1000)}s${rawDelayMs > MAX_RETRY_DELAY_MS ? ` (capped from ${Math.round(rawDelayMs / 1000)}s)` : ""} (${sanitizeDiagnostic(err)})`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Brief pause between sequential provider calls to reduce burst pressure.
 * Kept short — provider-specific TPM strategy belongs in routing/chunking, not long sleeps.
 */
export async function pauseBetweenProviderCalls(ms = 1_000): Promise<void> {
  await sleep(ms);
}
