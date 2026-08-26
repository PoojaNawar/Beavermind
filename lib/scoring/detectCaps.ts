import type { CallType } from "@/lib/rubrics/types";

/**
 * Deterministic / validated auto-cap IDs.
 *
 * Backend remains the authority that *applies* caps.
 * Only fire (or keep) caps that can be checked from the transcript with
 * reliable string evidence — no sentiment, no fuzzy AI.
 *
 * Caps that cannot be verified (monologue %, follow-up counting, etc.)
 * still accept the model's firedCapIds proposal when present.
 */

export function hasNorthStarMention(transcript: string): boolean {
  return /north\s*star/i.test(transcript);
}

/** Live booking: verbal date/time confirmation (not "assistant will email times"). */
export function hasLiveNextCallBooking(transcript: string): boolean {
  const deferral =
    /assistant handles the scheduling|she'll reach out|he'll reach out|reach out .{0,40}(with )?some times|grab whatever works/i.test(
      transcript,
    );
  if (deferral) return false;

  const lockedLive =
    /(?:next call|follow[- ]?up).{0,80}(?:lock|book|schedule).{0,60}(?:tuesday|wednesday|thursday|friday|monday|saturday|sunday|\d{1,2}\s*(?::\d{2})?\s*(?:am|pm))/i.test(
      transcript,
    ) ||
    /(?:tuesday|wednesday|thursday|friday|monday).{0,40}\d{1,2}\s*(?::\d{2})?\s*(?:am|pm).{0,40}(?:work|confirm|perfect|sounds good|locked)/i.test(
      transcript,
    );

  return lockedLive;
}

export function detectDeterministicCapIds(
  callType: CallType,
  transcript: string,
): string[] {
  const ids: string[] = [];

  if (callType === "kickoff" && !hasNorthStarMention(transcript)) {
    ids.push("no-north-star");
  }

  if (callType === "coaching" && !hasLiveNextCallBooking(transcript)) {
    // Rubric: not booked live → hard 0. Fire whenever live booking is absent.
    ids.push("next-call-not-booked");
  }

  return ids;
}

/**
 * Validate model-proposed caps that we can check; always keep unverifiable ones.
 */
export function resolveFiredCapIds(args: {
  callType: CallType;
  transcript: string;
  modelFiredIds: string[];
}): string[] {
  const { callType, transcript, modelFiredIds } = args;
  const deterministic = detectDeterministicCapIds(callType, transcript);
  const merged = new Set<string>(deterministic);

  for (const id of modelFiredIds) {
    if (id === "no-north-star") {
      if (!hasNorthStarMention(transcript)) merged.add(id);
      continue;
    }
    if (id === "next-call-not-booked") {
      if (!hasLiveNextCallBooking(transcript)) merged.add(id);
      continue;
    }
    // Unverifiable deterministically — keep model proposal.
    merged.add(id);
  }

  return [...merged];
}
