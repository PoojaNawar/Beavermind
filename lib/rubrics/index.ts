import type { CallType, Rubric } from "./types";
import { getKickoffRubric } from "./kickoff";
import { getCoachingRubric } from "./coaching";

export function getRubric(callType: CallType): Rubric {
  switch (callType) {
    case "kickoff":
      return getKickoffRubric();
    case "coaching":
      return getCoachingRubric();
    default: {
      const _exhaustive: never = callType;
      throw new Error(`Unknown call type: ${_exhaustive}`);
    }
  }
}

export function isCallType(value: string): value is CallType {
  return value === "kickoff" || value === "coaching";
}

export * from "./types";
