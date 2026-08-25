/**
 * End-to-end QA harness for BeaverMind call evaluations.
 *
 * Usage:
 *   npx tsx scripts/qa-run-evaluations.ts
 *
 * Requires .env.local with MODEL_API_KEY + Supabase credentials.
 * Starts against NEXT_PUBLIC_APP_URL (default http://localhost:3000).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { quoteExistsInTranscript } from "../lib/transcripts/handling";
import { getRubric } from "../lib/rubrics";
import type { CallType, EvaluationResult } from "../lib/rubrics/types";

const BASE = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const CASES: { file: string; callType: CallType; label: string }[] = [
  { file: "kickoff-01.txt", callType: "kickoff", label: "kickoff-01" },
  { file: "kickoff-02.txt", callType: "kickoff", label: "kickoff-02" },
  { file: "coaching-01.txt", callType: "coaching", label: "coaching-01" },
  { file: "coaching-02.txt", callType: "coaching", label: "coaching-02" },
];

interface QaFinding {
  severity: "pass" | "fail" | "warn";
  area: string;
  message: string;
}

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function createEvaluation(callType: CallType, transcript: string) {
  const res = await fetch(`${BASE}/api/evaluations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callType,
      transcript,
      clientName: "QA client",
      coachName: "QA coach",
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function getEvaluation(id: string) {
  const res = await fetch(`${BASE}/api/evaluations/${id}`, {
    cache: "no-store",
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function waitForTerminal(
  id: string,
  timeoutMs: number,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status, body } = await getEvaluation(id);
    if (body.status === "completed" || body.status === "failed") {
      return { status, body };
    }
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for evaluation ${id}`);
}

function verifyResult(
  label: string,
  callType: CallType,
  transcript: string,
  result: EvaluationResult,
): QaFinding[] {
  const findings: QaFinding[] = [];
  const rubric = getRubric(callType);
  const expectedIds = rubric.dimensions.map((d) => d.id);

  findings.push({
    severity: result.callType === callType ? "pass" : "fail",
    area: "rubric",
    message: `${label}: callType=${result.callType} rubricVersion=${result.rubricVersion}`,
  });

  findings.push({
    severity: result.dimensions.length === 12 ? "pass" : "fail",
    area: "dimensions",
    message: `${label}: dimension count=${result.dimensions.length}`,
  });

  const gotIds = result.dimensions.map((d) => d.id);
  const unknown = gotIds.filter((id) => !expectedIds.includes(id));
  const missing = expectedIds.filter((id) => !gotIds.includes(id));
  findings.push({
    severity: unknown.length === 0 && missing.length === 0 ? "pass" : "fail",
    area: "dimensions",
    message: `${label}: unknown=[${unknown}] missing=[${missing}]`,
  });

  let scoreSum = 0;
  let available = 0;
  for (const dim of result.dimensions) {
    if (dim.disabled || dim.notApplicable) continue;
    available += dim.maxScore;
    if (dim.score === null) {
      findings.push({
        severity: "fail",
        area: "scoring",
        message: `${label}: ${dim.id} active but score is null`,
      });
      continue;
    }
    if (dim.score < 0 || dim.score > dim.maxScore) {
      findings.push({
        severity: "fail",
        area: "scoring",
        message: `${label}: ${dim.id} score ${dim.score} outside 0–${dim.maxScore}`,
      });
    }
    scoreSum += dim.score;

    if (dim.notDemonstrated) {
      const invented = dim.evidence.filter(
        (e) => e.verificationStatus === "verified" || e.demonstrated,
      );
      findings.push({
        severity: invented.length === 0 ? "pass" : "fail",
        area: "evidence",
        message: `${label}: ${dim.id} marked notDemonstrated; demonstratedEvidence=${invented.length}`,
      });
    }

    for (const ev of dim.evidence) {
      if (ev.verificationStatus === "unverified") continue;
      if (ev.verificationStatus === "not_demonstrated") continue;
      if (!ev.demonstrated) continue;
      const ok = quoteExistsInTranscript(ev.quote, transcript);
      findings.push({
        severity: ok ? "pass" : "fail",
        area: "evidence",
        message: ok
          ? `${label}: ${dim.id} quote verified`
          : `${label}: ${dim.id} FABRICATED/UNMATCHED quote: "${ev.quote.slice(0, 100)}"`,
      });
    }
  }

  const expectedNormalized =
    available === 0
      ? 0
      : available === 100
        ? Math.round(scoreSum)
        : Math.round((scoreSum / available) * 100);

  // Caps may lower the score — overall must be <= uncapped normalized
  findings.push({
    severity: result.overallScore <= expectedNormalized + 1 ? "pass" : "fail",
    area: "scoring",
    message: `${label}: overall=${result.overallScore} uncappedNormalized<=${expectedNormalized} scoreOutOf=${result.scoreOutOf} raw≈${scoreSum} grade=${result.grade}`,
  });

  const bands = rubric.gradeBands;
  const band = bands.find(
    (b) => result.overallScore >= b.min && result.overallScore <= b.max,
  );
  findings.push({
    severity: band?.band === result.grade ? "pass" : "fail",
    area: "scoring",
    message: `${label}: grade ${result.grade} matches band table=${band?.band ?? "none"}`,
  });

  findings.push({
    severity: result.brief?.length > 20 ? "pass" : "fail",
    area: "report",
    message: `${label}: brief length=${result.brief?.length ?? 0}`,
  });
  findings.push({
    severity: result.oneThing?.recommendation?.length > 5 ? "pass" : "fail",
    area: "report",
    message: `${label}: oneThing present`,
  });
  findings.push({
    severity: Array.isArray(result.redFlags) ? "pass" : "fail",
    area: "report",
    message: `${label}: redFlags count=${result.redFlags?.length ?? "n/a"}`,
  });

  if (label === "kickoff-02") {
    const deepWhy = result.dimensions.find((d) => d.id === "d4");
    if (deepWhy) {
      const high = (deepWhy.score ?? 0) >= 15;
      findings.push({
        severity: high ? "fail" : "pass",
        area: "anti-hallucination",
        message: `${label}: D4 Goal Alignment score=${deepWhy.score} notDemonstrated=${deepWhy.notDemonstrated} (trap: must not invent deep why/North Star)`,
      });
    }
  }

  return findings;
}

async function downloadPdf(id: string, outPath: string): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];
  const res = await fetch(`${BASE}/api/evaluations/${id}/pdf`);
  if (!res.ok) {
    findings.push({
      severity: "fail",
      area: "pdf",
      message: `PDF HTTP ${res.status} for ${id}`,
    });
    return findings;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  findings.push({
    severity: buf.length > 1000 ? "pass" : "fail",
    area: "pdf",
    message: `PDF saved ${outPath} (${buf.length} bytes)`,
  });
  // PDFKit output should start with %PDF
  findings.push({
    severity: buf.subarray(0, 4).toString() === "%PDF" ? "pass" : "fail",
    area: "pdf",
    message: `PDF magic header=${buf.subarray(0, 5).toString()}`,
  });
  return findings;
}

async function errorCases(): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];

  const empty = await createEvaluation("kickoff", "");
  findings.push({
    severity: empty.status === 400 ? "pass" : "fail",
    area: "errors",
    message: `empty transcript → ${empty.status} ${JSON.stringify(empty.body).slice(0, 120)}`,
  });

  const badType = await fetch(`${BASE}/api/evaluations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callType: "sales", transcript: "[A]: hi" }),
  });
  const badBody = await badType.json();
  findings.push({
    severity: badType.status === 400 ? "pass" : "fail",
    area: "errors",
    message: `invalid call type → ${badType.status} ${JSON.stringify(badBody).slice(0, 120)}`,
  });

  const missing = await getEvaluation("00000000-0000-4000-8000-000000000000");
  findings.push({
    severity: missing.status === 404 ? "pass" : "fail",
    area: "errors",
    message: `missing id → ${missing.status}`,
  });

  return findings;
}

async function main() {
  loadEnvFiles();

  const required = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `Missing env: ${missing.join(", ")}. Create .env.local from .env.example.`,
    );
    process.exit(2);
  }

  const outDir = path.join(process.cwd(), "qa-output");
  mkdirSync(outDir, { recursive: true });

  const all: QaFinding[] = [];
  all.push(...(await errorCases()));

  for (const c of CASES) {
    const transcript = readFileSync(
      path.join(process.cwd(), "transcripts", c.file),
      "utf8",
    );
    console.log(`\n=== ${c.label} (${transcript.length} chars) ===`);
    const created = await createEvaluation(c.callType, transcript);
    if (created.status !== 201) {
      all.push({
        severity: "fail",
        area: "pipeline",
        message: `${c.label}: create failed ${created.status} ${JSON.stringify(created.body)}`,
      });
      continue;
    }
    const id = created.body.id as string;
    console.log(`created ${id}`);
    all.push({
      severity: "pass",
      area: "persistence",
      message: `${c.label}: created ${id} url=${created.body.url}`,
    });

    const timeout = c.label === "coaching-02" ? 15 * 60_000 : 8 * 60_000;
    let terminal;
    try {
      terminal = await waitForTerminal(id, timeout);
    } catch (err) {
      all.push({
        severity: "fail",
        area: "pipeline",
        message: `${c.label}: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    writeFileSync(
      path.join(outDir, `${c.label}.json`),
      JSON.stringify(terminal.body, null, 2),
    );

    if (terminal.body.status === "failed") {
      all.push({
        severity: "fail",
        area: "pipeline",
        message: `${c.label}: FAILED — ${terminal.body.errorMessage}`,
      });
      continue;
    }

    const result = terminal.body.result as EvaluationResult;
    all.push(...verifyResult(c.label, c.callType, transcript, result));

    // Persistence re-fetch
    const again = await getEvaluation(id);
    all.push({
      severity:
        again.body.status === "completed" && again.body.result ? "pass" : "fail",
      area: "persistence",
      message: `${c.label}: re-fetch status=${again.body.status}`,
    });

    const page = await fetch(`${BASE}/evaluations/${id}`);
    all.push({
      severity: page.status === 200 ? "pass" : "fail",
      area: "ui",
      message: `${c.label}: page /evaluations/${id} → ${page.status}`,
    });

    all.push(
      ...(await downloadPdf(id, path.join(outDir, `${c.label}.pdf`))),
    );
  }

  const summary = {
    pass: all.filter((f) => f.severity === "pass").length,
    fail: all.filter((f) => f.severity === "fail").length,
    warn: all.filter((f) => f.severity === "warn").length,
    findings: all,
  };
  writeFileSync(
    path.join(outDir, "qa-report.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log("\n===== QA SUMMARY =====");
  console.log(`pass=${summary.pass} fail=${summary.fail} warn=${summary.warn}`);
  for (const f of all.filter((x) => x.severity === "fail")) {
    console.log(`FAIL [${f.area}] ${f.message}`);
  }
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
