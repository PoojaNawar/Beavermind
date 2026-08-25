import { readFileSync } from "fs";
import path from "path";

function readSafe(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Load canonical rubric markdown. Each path is a string literal so Vercel
 * file tracing can include `rubrics/*.md` in the serverless bundle.
 * Empty string if the file is missing — prompts use the compact typed rubric.
 */
export function loadKickoffMarkdown(): string {
  const text = readSafe(
    path.join(process.cwd(), "rubrics/kickoff-call-rubric.md"),
  );
  if (!text) {
    console.warn("[rubrics] markdown not bundled: kickoff-call-rubric.md");
  }
  return text;
}

export function loadCoachingMarkdown(): string {
  const text = readSafe(
    path.join(process.cwd(), "rubrics/coaching-call-rubric.md"),
  );
  if (!text) {
    console.warn("[rubrics] markdown not bundled: coaching-call-rubric.md");
  }
  return text;
}
