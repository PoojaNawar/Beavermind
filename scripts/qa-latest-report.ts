/**
 * Fetch the newest completed evaluation and dump a verification summary.
 * Usage: npx tsx scripts/qa-latest-report.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { hydrateCompletedReport } from "../lib/scoring/hydrateReport";
import type { EvaluationResult } from "../lib/rubrics/types";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || process.env[m[1]!]) continue;
      let v = m[2]!.trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]!] = v;
    }
  }
}

function guessTranscriptFile(callType: string, clientName: string | null): string | null {
  const map: Record<string, string> = {
    "kickoff-01": "transcripts/kickoff-01.txt",
    "kickoff-02": "transcripts/kickoff-02.txt",
    "coaching-01": "transcripts/coaching-01.txt",
    "coaching-02": "transcripts/coaching-02.txt",
  };
  const key = (clientName || "").trim().toLowerCase();
  if (map[key]) return map[key]!;
  if (callType === "kickoff" && key.includes("owen")) return "transcripts/kickoff-01.txt";
  if (callType === "kickoff" && key.includes("renata")) return "transcripts/kickoff-02.txt";
  if (callType === "coaching" && key.includes("malik")) return "transcripts/coaching-01.txt";
  if (callType === "coaching" && key.includes("hannah")) return "transcripts/coaching-02.txt";
  return null;
}

async function main() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SECRET");
    process.exit(1);
  }

  const sb = createClient(url, key);
  const { data: rows, error } = await sb
    .from("evaluations")
    .select(
      "id, call_type, client_name, coach_name, status, created_at, result, transcript, rubric_version",
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) {
    console.error("No completed evaluation found:", error?.message ?? "empty");
    process.exit(1);
  }

  const row = rows[0]!;
  const raw = row.result as EvaluationResult;
  const transcript =
    typeof row.transcript === "string" && row.transcript.trim()
      ? row.transcript
      : (() => {
          const file = guessTranscriptFile(row.call_type, row.client_name);
          return file && existsSync(file) ? readFileSync(file, "utf8") : "";
        })();

  const report = hydrateCompletedReport(raw, transcript || null);

  const summary = {
    id: row.id,
    createdAt: row.created_at,
    callType: row.call_type,
    clientName: row.client_name,
    coachName: row.coach_name,
    rubricVersion: row.rubric_version,
    score: report.overallScore,
    grade: report.grade,
    scoreOutOf: report.scoreOutOf,
    oneThing: report.oneThing.recommendation,
    impact: report.oneThing.impact,
    firedCaps: report.firedCaps,
    redFlags: report.redFlags,
    dimensions: report.dimensions.map((d) => ({
      id: d.id,
      name: d.name,
      score: d.score,
      maxScore: d.maxScore,
      disabled: d.disabled,
      notApplicable: d.notApplicable,
      rationale: d.rationale,
      quickFix: d.quickFix,
      verified: d.verifiedEvidenceCount,
      rejected: d.rejectedEvidenceCount,
      evidence: d.evidence.map((e) => ({
        status: e.verificationStatus,
        demonstrated: e.demonstrated,
        speaker: e.speaker,
        quote: e.quote,
      })),
    })),
  };

  mkdirSync("qa-output", { recursive: true });
  const outPath = path.join("qa-output", "latest-report.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log("Wrote", outPath);
  console.log(
    [
      `id=${summary.id}`,
      `created=${summary.createdAt}`,
      `type=${summary.callType}`,
      `client=${summary.clientName}`,
      `coach=${summary.coachName}`,
      `score=${summary.score}/${summary.scoreOutOf} ${summary.grade}`,
      `oneThing=${summary.oneThing}`,
      `flags=${summary.redFlags.map((f) => f.title).join(" | ") || "(none)"}`,
    ].join("\n"),
  );
  for (const d of summary.dimensions) {
    const s =
      d.score === null || d.notApplicable || d.disabled
        ? "N/A"
        : `${d.score}/${d.maxScore}`;
    console.log(`${d.id} ${d.name}: ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
