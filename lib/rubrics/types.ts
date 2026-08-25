export type CallType = "kickoff" | "coaching";

export type GradeBand = "Elite" | "Strong" | "Inconsistent" | "At risk" | "Fail";

export type EvaluationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingPath = "single" | "chunked";

export interface EvaluationAudit {
  provider: string | null;
  pipelineVersion: string | null;
  processingPath: ProcessingPath | null;
  chunkCount: number | null;
  modelCallCount: number | null;
  retryCount: number;
  processingDurationMs: number | null;
  evidenceCount: number | null;
  verifiedEvidenceCount: number | null;
  rejectedEvidenceCount: number | null;
}

export interface ScoreBand {
  name: string;
  /** Inclusive min score for this band within the dimension */
  min: number;
  /** Inclusive max score for this band within the dimension */
  max: number;
  criteria: string;
}

export interface RubricDimension {
  id: string;
  name: string;
  maxScore: number;
  description: string;
  scoringCriteria: string;
  bands: ScoreBand[];
  /** Coaching D4 — may be disabled when no movement coaching occurred */
  optional?: boolean;
  /** Coaching D2 — may be N/A on non-milestone calls */
  mayBeNotApplicable?: boolean;
  positiveSignals?: string[];
  negativeSignals?: string[];
  discreteScores?: number[];
}

export interface AutoCap {
  id: string;
  condition: string;
  /** Cap total score */
  maxTotal?: number;
  /** Cap a specific dimension */
  dimensionId?: string;
  maxDimensionScore?: number;
  /** Force a dimension score to this value */
  forceDimensionScore?: number;
}

export interface Rubric {
  id: CallType;
  version: string;
  name: string;
  totalPoints: number;
  dimensions: RubricDimension[];
  gradeBands: { band: GradeBand; min: number; max: number; description: string }[];
  autoCaps: AutoCap[];
  scoringNotes: string[];
  /** Full rubric markdown for the prompt */
  sourceMarkdown: string;
}

/** Backend verification of a single proposed quote against the original transcript. */
export type EvidenceVerificationStatus =
  | "verified"
  | "unverified"
  | "not_demonstrated";

/**
 * Dimension-level evidence presentation status.
 * Derived from item statuses; never an input to scoring.
 */
export type DimensionEvidenceStatus =
  | "verified"
  | "partially_verified"
  | "unverified"
  | "not_demonstrated";

/**
 * How much transcript-anchored support survived verification.
 * Metadata only — never an input to scoring.
 */
export type EvidenceStrength = "high" | "medium" | "low";

export interface EvidenceItem {
  quote: string;
  speaker: string | null;
  location: string | null;
  /**
   * Coach-facing: true only when verificationStatus is "verified".
   * Unverified proposals keep demonstrated=false so they cannot be read as proof.
   */
  demonstrated: boolean;
  verificationStatus: EvidenceVerificationStatus;
}

export interface EvidenceQualitySummary {
  found: number;
  verified: number;
  rejected: number;
  notDemonstratedDimensions: number;
}

export interface DimensionResult {
  id: string;
  name: string;
  score: number | null;
  maxScore: number;
  disabled: boolean;
  disabledReason: string | null;
  notApplicable: boolean;
  notApplicableReason: string | null;
  band: string | null;
  rationale: string;
  evidence: EvidenceItem[];
  quickFix: string;
  notDemonstrated: boolean;
  evidenceFound: boolean;
  verifiedEvidenceCount: number;
  rejectedEvidenceCount: number;
  evidenceStrength: EvidenceStrength;
}

export interface RedFlag {
  title: string;
  explanation: string;
  evidence: string;
}

export interface OneThing {
  recommendation: string;
  impact: string;
  /** Null when not reliably determinable from the rubric */
  scoreIfApplied: number | null;
  scoreIfAppliedBasis: string;
}

export interface FiredCap {
  id: string;
  condition: string;
  effect: string;
}

export interface EvaluationResult {
  callType: CallType;
  rubricVersion: string;
  overallScore: number;
  /** Denominator before percentage normalization (100 or 85) */
  scoreOutOf: number;
  grade: GradeBand;
  oneThing: OneThing;
  brief: string;
  redFlags: RedFlag[];
  dimensions: DimensionResult[];
  firedCaps: FiredCap[];
  modelName: string;
  evidenceQuality: EvidenceQualitySummary;
}

export interface EvaluationRecord {
  id: string;
  callType: CallType;
  transcript: string;
  status: EvaluationStatus;
  stage: string | null;
  result: EvaluationResult | null;
  errorMessage: string | null;
  rubricVersion: string;
  modelName: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  audit: EvaluationAudit;
}
