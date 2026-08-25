export type EvaluationErrorCode =
  | "provider_unavailable"
  | "rate_limited"
  | "invalid_model_response"
  | "validation_failed"
  | "database_error"
  | "request_invalid"
  | "unknown";

const SECRET_RE =
  /api[_-]?key|sk-[a-zA-Z0-9_-]+|service_role|Bearer\s+\S+|GROQ_KEY|OPENAI_API_KEY|SUPABASE_SECRET/gi;

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function containsSecret(msg: string): boolean {
  SECRET_RE.lastIndex = 0;
  return SECRET_RE.test(msg);
}

/** Strip secrets and truncate for logs. Never log transcripts. */
export function sanitizeDiagnostic(err: unknown): string {
  SECRET_RE.lastIndex = 0;
  let msg = rawMessage(err).replace(SECRET_RE, "[redacted]");
  msg = msg.replace(/[A-Za-z]:\\[^\s]+/g, "[path]");
  msg = msg.replace(/\/(?:Users|home|var)\/[^\s]+/g, "[path]");
  return msg.slice(0, 240);
}

export function classifyEvaluationError(err: unknown): EvaluationErrorCode {
  const msg = rawMessage(err);

  if (/not configured|not set|misconfigured/i.test(msg)) {
    return "provider_unavailable";
  }
  if (/rate limit|429|TPM|tokens per minute/i.test(msg)) {
    return "rate_limited";
  }
  if (/timeout|ETIMEDOUT|aborted|ECONNRESET|ENOTFOUND|fetch failed|503|502/i.test(msg)) {
    return "provider_unavailable";
  }
  if (/Zod|invalid evaluation structure|Unknown dimension|outside 0|must be one of|Expected 12/i.test(msg)) {
    return "invalid_model_response";
  }
  if (/validation|Invalid JSON|Empty request|Transcript is/i.test(msg)) {
    return "validation_failed";
  }
  if (/Database error|Supabase/i.test(msg)) {
    return "database_error";
  }
  if (/Invalid call type|Invalid JSON body/i.test(msg)) {
    return "request_invalid";
  }
  return "unknown";
}

export function publicErrorMessage(err: unknown): string {
  switch (classifyEvaluationError(err)) {
    case "rate_limited":
      return "Evaluation could not be completed because the AI service was busy. Please retry in a moment.";
    case "provider_unavailable":
      return "Evaluation could not be completed because the AI service was temporarily unavailable.";
    case "database_error":
      return "Evaluation could not be saved. Please retry.";
    case "request_invalid":
      return "The request could not be processed. Check the transcript and try again.";
    case "invalid_model_response":
    case "validation_failed":
    case "unknown":
    default:
      break;
  }

  if (containsSecret(rawMessage(err))) {
    return "Evaluation could not be completed. Please retry.";
  }

  return "Evaluation could not be completed. Please retry.";
}
