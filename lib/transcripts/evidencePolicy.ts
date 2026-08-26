/**
 * Evidence / score consistency after quote verification.
 *
 * POLICY:
 * 1. Unverified quotes never count as transcript proof and must not carry Elite.
 * 2. When every proposed quote for a scored dimension is unverified, cap the
 *    score down from full marks to the next lower band — never raise a score.
 * 3. Do NOT flip notDemonstrated solely because quotes failed matching
 *    (paraphrase / punctuation can still leave a below-Elite score intact).
 * 4. Rationales that treat unverified quotes as established fact are rewritten.
 */

import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

export const EVIDENCE_INSUFFICIENT_NOTE =
  " [Verification: cited quote(s) could not be matched in the transcript; score was limited so unverified evidence cannot support full marks.]";

const UNVERIFIED_AS_FACT =
  /\b(the client|they|he|she)\b.{0,40}\b(clearly )?(stated|named|established|confirmed|shared|said)\b/i;

function isVerified(e: {
  verificationStatus?: string;
  demonstrated: boolean;
}): boolean {
  return (
    e.verificationStatus === "verified" ||
    (!e.verificationStatus && e.demonstrated)
  );
}

function isUnverified(e: { verificationStatus?: string }): boolean {
  return e.verificationStatus === "unverified";
}

function stripVerificationNote(text: string): string {
  return text.replace(/\s*\[Verification:[^\]]*\]/g, "").trim();
}

/**
 * Cap full marks when nothing verified supports the claim.
 * Discrete dimensions snap to the next lower bucket; continuous dims drop ~30%.
 * Never raises a score.
 */
export function capScoreWithoutVerifiedEvidence(
  score: number,
  maxScore: number,
  discreteScores?: number[],
): number {
  if (score < maxScore) return score;

  if (discreteScores && discreteScores.length > 0) {
    const below = [...discreteScores]
      .filter((s) => s < maxScore)
      .sort((a, b) => b - a);
    return below[0] ?? Math.max(0, maxScore - 1);
  }

  return Math.max(0, Math.round(maxScore * 0.7));
}

export function rewriteUnverifiedRationale(rationale: string): string {
  let text = stripVerificationNote(rationale);
  if (UNVERIFIED_AS_FACT.test(text)) {
    text =
      "The transcript does not provide sufficient verified evidence for the claimed behaviour.";
  }
  return text;
}

export function reconcileDimensionAfterVerification(
  dim: ModelEvaluationOutput["dimensions"][number],
  opts?: { maxScore?: number; discreteScores?: number[] },
): ModelEvaluationOutput["dimensions"][number] {
  const verifiedPositive = dim.evidence.filter(isVerified);
  const hadUnverified = dim.evidence.some(isUnverified);
  const notDemonstrated = dim.notDemonstrated === true;

  let score = dim.score;

  const onlyUnverifiedSupport =
    hadUnverified &&
    verifiedPositive.length === 0 &&
    !notDemonstrated &&
    score !== null &&
    !dim.disabled &&
    !dim.notApplicable;

  if (onlyUnverifiedSupport && score !== null) {
    const maxScore = opts?.maxScore ?? score;
    score = capScoreWithoutVerifiedEvidence(
      score,
      maxScore,
      opts?.discreteScores,
    );
  }

  let rationale = dim.rationale;
  if (onlyUnverifiedSupport) {
    rationale = `${rewriteUnverifiedRationale(rationale)}${EVIDENCE_INSUFFICIENT_NOTE}`;
  }

  return {
    ...dim,
    score,
    rationale,
    notDemonstrated,
  };
}

export function reconcileModelOutputAfterVerification(
  model: ModelEvaluationOutput,
  rubric?: {
    dimensions: { id: string; maxScore: number; discreteScores?: number[] }[];
  },
): ModelEvaluationOutput {
  const byId = new Map(
    (rubric?.dimensions ?? []).map((d) => [d.id, d] as const),
  );
  return {
    ...model,
    dimensions: model.dimensions.map((dim) => {
      const def = byId.get(dim.id);
      return reconcileDimensionAfterVerification(dim, {
        maxScore: def?.maxScore,
        discreteScores: def?.discreteScores,
      });
    }),
  };
}
