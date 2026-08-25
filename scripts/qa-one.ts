/**
 * Single-transcript live run. Usage: npx tsx scripts/qa-one.ts kickoff-01
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const label = process.argv[2];
const map: Record<string, { file: string; callType: "kickoff" | "coaching" }> = {
  "kickoff-01": { file: "kickoff-01.txt", callType: "kickoff" },
  "kickoff-02": { file: "kickoff-02.txt", callType: "kickoff" },
  "coaching-01": { file: "coaching-01.txt", callType: "coaching" },
  "coaching-02": { file: "coaching-02.txt", callType: "coaching" },
};

if (!label || !map[label]) {
  console.error("Usage: npx tsx scripts/qa-one.ts kickoff-01|kickoff-02|coaching-01|coaching-02");
  process.exit(2);
}

const BASE = "http://localhost:3000";
const { file, callType } = map[label];
const transcript = readFileSync(path.join("transcripts", file), "utf8");

async function main() {
  const started = Date.now();
  console.log(`POST ${label} ${transcript.length} chars as ${callType}`);

  const create = await fetch(`${BASE}/api/evaluations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callType, transcript }),
  });
  const createText = await create.text();
  console.log("create HTTP", create.status, createText.slice(0, 400));
  if (create.status !== 201) process.exit(1);
  const created = JSON.parse(createText);
  const id = created.id as string;
  console.log("id", id, "url", created.url);

  const timeout = label === "coaching-02" ? 25 * 60_000 : 15 * 60_000;
  while (Date.now() - started < timeout) {
    const res = await fetch(`${BASE}/api/evaluations/${id}`, { cache: "no-store" });
    const body = await res.json();
    console.log("poll", body.status, body.errorMessage ?? "");
    if (body.status === "completed" || body.status === "failed") {
      mkdirSync("qa-output", { recursive: true });
      writeFileSync(
        path.join("qa-output", `${label}.json`),
        JSON.stringify(body, null, 2),
      );
      console.log("elapsed_ms", Date.now() - started);
      if (body.status === "failed") process.exit(1);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.error("timeout");
  process.exit(1);
}

main();
