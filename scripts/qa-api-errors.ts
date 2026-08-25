/**
 * API validation QA that runs without MODEL/Supabase secrets.
 * Covers empty transcript + invalid call type (fail before DB).
 */
async function main() {
  const BASE = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const findings: { ok: boolean; msg: string }[] = [];

  async function post(body: unknown) {
    const res = await fetch(`${BASE}/api/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  const empty = await post({ callType: "kickoff", transcript: "" });
  findings.push({
    ok: empty.status === 400,
    msg: `empty transcript → ${empty.status} ${JSON.stringify(empty.body)}`,
  });

  const bad = await post({ callType: "sales", transcript: "[A]: hi" });
  findings.push({
    ok: bad.status === 400,
    msg: `invalid call type → ${bad.status} ${JSON.stringify(bad.body)}`,
  });

  const whitespace = await post({ callType: "coaching", transcript: "   \n\t  " });
  findings.push({
    ok: whitespace.status === 400,
    msg: `whitespace transcript → ${whitespace.status} ${JSON.stringify(whitespace.body)}`,
  });

  const missing = await fetch(
    `${BASE}/api/evaluations/00000000-0000-4000-8000-000000000000`,
  );
  const missingBody = await missing.json();
  findings.push({
    ok: missing.status === 404 || missing.status === 500,
    msg: `missing id → ${missing.status} ${JSON.stringify(missingBody).slice(0, 200)}`,
  });

  console.log(findings.map((f) => `${f.ok ? "PASS" : "FAIL"} ${f.msg}`).join("\n"));
  process.exit(findings.every((f) => f.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
