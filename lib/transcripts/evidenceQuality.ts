import type {
  DimensionEvidenceStatus,
  DimensionResult,
  EvaluationResult,
  EvidenceItem,
  EvidenceQualitySummary,
  EvidenceStrength,
  EvidenceVerificationStatus,
} from "@/lib/rubrics/types";
import { applyReportPresentation } from "@/lib/ui/reportPresentation";
import {
  isNotDemonstratedPlaceholder,
  quoteExistsInTranscript,
} from "@/lib/transcripts/quoteMatch";

export const EVIDENCE_INSUFFICIENT_EXPLANATION =
  "One proposed evidence item could not be verified against the original transcript. The score was retained because evidence verification failure alone does not establish that the behavior was absent.";

export const EVIDENCE_INSUFFICIENT_EXPLANATION_PLURAL =
  "Proposed evidence items could not be verified against the original transcript. The score was retained because evidence verification failure alone does not establish that the behavior was absent.";

export { isNotDemonstratedPlaceholder };

/**
 * WHY exact (normalized) verification:
 * Semantic "close enough" would let paraphrases and invented lines look like
 * transcript proof. We only mark VERIFIED when the proposed excerpt is actually
 * present in the original transcript.
 */
export function classifyEvidenceItem(
  item: {
    quote: string;
    speaker: string | null;
    location: string | null;
    demonstrated: boolean;
  },
  transcript: string,
): EvidenceItem {
  const quote = item.quote.trim();

  if (!item.demonstrated || isNotDemonstratedPlaceholder(quote)) {
    return {
      quote: quote || "Not demonstrated in transcript",
      speaker: item.speaker,
      location: item.location,
      demonstrated: false,
      verificationStatus: "not_demonstrated",
    };
  }

  if (quoteExistsInTranscript(quote, transcript)) {
    return {
      quote,
      speaker: item.speaker,
      location: item.location,
      demonstrated: true,
      verificationStatus: "verified",
    };
  }

  // Keep the proposed quote for audit. Do not invent a replacement excerpt.
  return {
    quote,
    speaker: item.speaker,
    location: item.location,
    demonstrated: false,
    verificationStatus: "unverified",
  };
}

export function verifyEvidenceItems(
  evidence: Array<{
    quote: string;
    speaker: string | null;
    location: string | null;
    demonstrated: boolean;
  }>,
  transcript: string,
): EvidenceItem[] {
  return evidence.map((item) => classifyEvidenceItem(item, transcript));
}

export function isVerifiedEvidence(item: EvidenceItem): boolean {
  return item.verificationStatus === "verified";
}

export function isUnverifiedEvidence(item: EvidenceItem): boolean {
  return item.verificationStatus === "unverified";
}

/**
 * Fill verificationStatus for rows that skipped transcript checks (unit stubs).
 * Does not invent quotes.
 */
export function normalizeStoredEvidence(item: {
  quote: string;
  speaker: string | null;
  location: string | null;
  demonstrated: boolean;
  verificationStatus?: EvidenceVerificationStatus;
}): EvidenceItem {
  if (item.verificationStatus) {
    return {
      quote: item.quote,
      speaker: item.speaker,
      location: item.location,
      demonstrated: item.verificationStatus === "verified",
      verificationStatus: item.verificationStatus,
    };
  }
  return {
    quote: item.quote,
    speaker: item.speaker,
    location: item.location,
    demonstrated: item.demonstrated,
    verificationStatus: item.demonstrated ? "verified" : "not_demonstrated",
  };
}

/**
 * WHY strength cannot affect scoring bands on its own:
 * Strength measures verification completeness. Elite still requires verified
 * support when quotes were proposed — see evidencePolicy caps — but missing
 * quotes alone do not invent a Fail.
 */
export function evidenceStrengthFromVerifiedCount(
  verifiedCount: number,
): EvidenceStrength {
  if (verifiedCount >= 2) return "high";
  if (verifiedCount === 1) return "medium";
  return "low";
}

export function summarizeDimensionEvidence(
  evidence: EvidenceItem[],
  notDemonstrated: boolean,
): {
  evidenceFound: boolean;
  verifiedEvidenceCount: number;
  rejectedEvidenceCount: number;
  notDemonstrated: boolean;
  evidenceStrength: EvidenceStrength;
} {
  const verifiedEvidenceCount = evidence.filter(isVerifiedEvidence).length;
  const rejectedEvidenceCount = evidence.filter(isUnverifiedEvidence).length;
  return {
    evidenceFound: verifiedEvidenceCount + rejectedEvidenceCount > 0,
    verifiedEvidenceCount,
    rejectedEvidenceCount,
    notDemonstrated,
    evidenceStrength: evidenceStrengthFromVerifiedCount(verifiedEvidenceCount),
  };
}

export function summarizeReportEvidence(
  dimensions: Pick<
    DimensionResult,
    | "verifiedEvidenceCount"
    | "rejectedEvidenceCount"
    | "notDemonstrated"
    | "disabled"
    | "notApplicable"
  >[],
): EvidenceQualitySummary {
  let found = 0;
  let verified = 0;
  let rejected = 0;
  let notDemonstratedDimensions = 0;

  for (const dim of dimensions) {
    verified += dim.verifiedEvidenceCount;
    rejected += dim.rejectedEvidenceCount;
    found += dim.verifiedEvidenceCount + dim.rejectedEvidenceCount;
    if (dim.notDemonstrated && !dim.disabled && !dim.notApplicable) {
      notDemonstratedDimensions += 1;
    }
  }

  return { found, verified, rejected, notDemonstratedDimensions };
}

export interface DimensionEvidenceUi {
  state: DimensionEvidenceStatus;
  label: string;
  /** Green only when every supporting quote is verified. */
  tone: "success" | "caution" | "warning" | "neutral";
  explanation: string | null;
}

/**
 * Coach-facing dimension status. Mixed quotes are PARTIALLY VERIFIED —
 * never presented as fully verified. UNVERIFIED is never collapsed into
 * NOT DEMONSTRATED.
 */
export function dimensionEvidenceUi(dim: {
  id?: string;
  notDemonstrated: boolean;
  verifiedEvidenceCount: number;
  rejectedEvidenceCount: number;
  disabled?: boolean;
  notApplicable?: boolean;
}): DimensionEvidenceUi {
  if (dim.disabled || dim.notApplicable) {
    return {
      state: "not_demonstrated",
      label: "Not applicable",
      tone: "neutral",
      explanation: dim.disabled
        ? dim.id === "d4"
          ? "Movement coaching did not occur on this call, so this dimension was not scored."
          : "This dimension did not apply to the current call, so it was not scored."
        : dim.id === "d2"
          ? "Diagnostics review did not occur in this cycle, so this dimension was not scored."
          : "This dimension did not apply to the current call, so it was not scored.",
    };
  }

  if (dim.notDemonstrated) {
    return {
      state: "not_demonstrated",
      label: "Not demonstrated",
      tone: "neutral",
      explanation:
        "The transcript does not contain sufficient evidence that the behavior occurred.",
    };
  }

  if (dim.verifiedEvidenceCount > 0 && dim.rejectedEvidenceCount > 0) {
    return {
      state: "partially_verified",
      label: "Partially verified",
      tone: "caution",
      explanation:
        "At least one proposed evidence item was found in the original transcript, and at least one could not be verified. Individual item statuses are unchanged; the dimension score was not adjusted.",
    };
  }

  if (dim.verifiedEvidenceCount === 0 && dim.rejectedEvidenceCount > 0) {
    const explanation =
      dim.rejectedEvidenceCount === 1
        ? EVIDENCE_INSUFFICIENT_EXPLANATION
        : EVIDENCE_INSUFFICIENT_EXPLANATION_PLURAL;
    return {
      state: "unverified",
      label: "⚠ Unverified",
      tone: "warning",
      explanation,
    };
  }

  if (dim.verifiedEvidenceCount > 0 && dim.rejectedEvidenceCount === 0) {
    return {
      state: "verified",
      label: "Verified",
      tone: "success",
      explanation:
        "All supporting evidence was found in the original transcript.",
    };
  }

  return {
    state: "unverified",
    label: "⚠ Unverified",
    tone: "warning",
    explanation:
      "No transcript evidence is attached. The score was retained because missing quotes alone do not prove the behavior was absent under the rubric.",
  };
}

/** Fill evidence metadata on stored results that predate Phase 2 fields. */
export function hydrateDimensionEvidence(dim: DimensionResult): DimensionResult {
  const evidence = dim.evidence.map((item) =>
    normalizeStoredEvidence({
      quote: item.quote,
      speaker: item.speaker,
      location: item.location,
      demonstrated: item.demonstrated,
      verificationStatus: item.verificationStatus,
    }),
  );
  const quality = summarizeDimensionEvidence(evidence, dim.notDemonstrated);
  return { ...dim, evidence, ...quality };
}

export function hydrateEvaluationResult(result: EvaluationResult): EvaluationResult {
  const dimensions = result.dimensions.map(hydrateDimensionEvidence);
  const hydrated = {
    ...result,
    dimensions,
    evidenceQuality: result.evidenceQuality ?? summarizeReportEvidence(dimensions),
  };
  return applyReportPresentation(hydrated);
}
