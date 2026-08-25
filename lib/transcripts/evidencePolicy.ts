import type { ModelEvaluationOutput } from "@/lib/validation/schemas";

/**
 * Evidence / score consistency after quote verification.
 *
 * POLICY (rubric-safe):
 * 1. Preserve the model dimension score — failed quote matching alone does not
 *    prove the behaviour was absent (paraphrase, truncation, punctuation).
 * 2. Unverified quotes stay in the payload for audit, but demonstrated=false so
 *    they cannot be presented as verified proof.
 * 3. Do NOT flip notDemonstrated to true solely because quotes failed matching.
 * 4. When claimed quotes were all rejected but the score remains, append an
 *    explicit verification note so the report cannot be read as
 *    "score X supported by verified evidence".
 */

export const EVIDENCE_INSUFFICIENT_NOTE =
  " [Verification: cited quote(s) could not be matched in the transcript; score retained because quote-match failure alone does not prove the behaviour was absent under the rubric.]";

export function reconcileDimensionAfterVerification(
  dim: ModelEvaluationOutput["dimensions"][number],
): ModelEvaluationOutput["dimensions"][number] {
  const verifiedPositive = dim.evidence.filter(
    (e) => e.verificationStatus === "verified" || (!e.verificationStatus && e.demonstrated),
  );
  const hadUnverified = dim.evidence.some(
    (e) => e.verificationStatus === "unverified",
  );

  const notDemonstrated = dim.notDemonstrated === true;

  let rationale = dim.rationale;
  const needsNote =
    hadUnverified &&
    verifiedPositive.length === 0 &&
    !notDemonstrated &&
    dim.score !== null;

  if (needsNote && !rationale.includes("[Verification:")) {
    rationale = `${rationale}${EVIDENCE_INSUFFICIENT_NOTE}`;
  }

  return {
    ...dim,
    rationale,
    notDemonstrated,
  };
}

export function reconcileModelOutputAfterVerification(
  model: ModelEvaluationOutput,
): ModelEvaluationOutput {
  return {
    ...model,
    dimensions: model.dimensions.map(reconcileDimensionAfterVerification),
  };
}
