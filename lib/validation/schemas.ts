import { z } from "zod";
import type { Rubric } from "@/lib/rubrics/types";

export const evidenceItemSchema = z.object({
  quote: z.string(),
  speaker: z.string().nullable(),
  location: z.string().nullable(),
  demonstrated: z.boolean(),
});

export const modelDimensionSchema = z.object({
  id: z.string(),
  score: z.number().nullable(),
  disabled: z.boolean(),
  disabledReason: z.string().nullable(),
  notApplicable: z.boolean(),
  notApplicableReason: z.string().nullable(),
  band: z.string().nullable(),
  rationale: z.string(),
  evidence: z.array(evidenceItemSchema),
  quickFix: z.string(),
  notDemonstrated: z.boolean(),
});

export const modelEvaluationSchema = z.object({
  oneThing: z.object({
    recommendation: z.string(),
    impact: z.string(),
    /** Points that would be gained if applied — backend may recompute scoreIfApplied */
    estimatedPointsGained: z.number().nullable(),
    scoreIfAppliedBasis: z.string(),
  }),
  brief: z.string(),
  redFlags: z.array(
    z.object({
      title: z.string(),
      explanation: z.string(),
      evidence: z.string(),
    }),
  ),
  dimensions: z.array(modelDimensionSchema).length(12),
  firedCapIds: z.array(z.string()),
  notes: z.string(),
});

export type ModelEvidenceVerificationStatus =
  | "verified"
  | "unverified"
  | "not_demonstrated";

/** Model JSON plus backend verificationStatus added after quote matching. */
export type ModelEvidenceItem = z.infer<typeof evidenceItemSchema> & {
  verificationStatus?: ModelEvidenceVerificationStatus;
};

export type ModelDimensionOutput = Omit<
  z.infer<typeof modelDimensionSchema>,
  "evidence"
> & {
  evidence: ModelEvidenceItem[];
};

export type ModelEvaluationOutput = Omit<
  z.infer<typeof modelEvaluationSchema>,
  "dimensions"
> & {
  dimensions: ModelDimensionOutput[];
};

export function validateModelOutput(
  raw: unknown,
  rubric: Rubric,
): ModelEvaluationOutput {
  const parsed = modelEvaluationSchema.parse(raw);

  const expectedIds = new Set(rubric.dimensions.map((d) => d.id));
  const seen = new Set<string>();

  for (const dim of parsed.dimensions) {
    if (!expectedIds.has(dim.id)) {
      throw new Error(`Unknown dimension id from model: ${dim.id}`);
    }
    if (seen.has(dim.id)) {
      throw new Error(`Duplicate dimension id from model: ${dim.id}`);
    }
    seen.add(dim.id);

    const def = rubric.dimensions.find((d) => d.id === dim.id)!;

    if (dim.disabled || dim.notApplicable) {
      if (dim.score !== null) {
        throw new Error(
          `Dimension ${dim.id} is disabled/N/A but has a score`,
        );
      }
      continue;
    }

    if (dim.score === null) {
      throw new Error(`Dimension ${dim.id} is missing a score`);
    }
    if (dim.score < 0 || dim.score > def.maxScore) {
      throw new Error(
        `Dimension ${dim.id} score ${dim.score} outside 0–${def.maxScore}`,
      );
    }

    if (def.discreteScores && def.discreteScores.length > 0) {
      const allowed = def.discreteScores;
      // Allow half-steps only for kickoff dimensions without discrete lists
      if (!allowed.includes(dim.score)) {
        // Soft: snap later in scoring — here reject only if wildly off
        // Coaching requires exact buckets
        if (rubric.id === "coaching") {
          throw new Error(
            `Dimension ${dim.id} score ${dim.score} must be one of ${allowed.join(", ")}`,
          );
        }
      }
    }
  }

  if (seen.size !== 12) {
    throw new Error(
      `Expected 12 dimensions, got ${seen.size}: missing ${[...expectedIds]
        .filter((id) => !seen.has(id))
        .join(", ")}`,
    );
  }

  return parsed;
}

export const createEvaluationBodySchema = z.object({
  callType: z.enum(["kickoff", "coaching"]),
  transcript: z.string().min(1, "Transcript is required"),
});
