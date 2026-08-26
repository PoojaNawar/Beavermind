import { describe, expect, it } from "vitest";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";
import type { DimensionResult, EvidenceItem } from "@/lib/rubrics/types";

function dim(
  overrides: Partial<DimensionResult> &
    Pick<DimensionResult, "id" | "name" | "score" | "maxScore" | "quickFix">,
): DimensionResult {
  return {
    disabled: false,
    disabledReason: null,
    notApplicable: false,
    notApplicableReason: null,
    band: null,
    rationale: "Scored from the rubric bands.",
    evidence: [],
    notDemonstrated: false,
    evidenceFound: false,
    verifiedEvidenceCount: 0,
    rejectedEvidenceCount: 0,
    evidenceStrength: "low",
    ...overrides,
  };
}

function verified(quote: string): EvidenceItem {
  return {
    quote,
    speaker: "Dana Whitlock",
    location: null,
    demonstrated: true,
    verificationStatus: "verified",
  };
}

describe("presentQuickFix", () => {
  it("shows Full marks were reached on a perfect dimension", () => {
    const view = presentQuickFix(
      dim({
        id: "d1",
        name: "Pre-Call Preparation",
        score: 10,
        maxScore: 10,
        quickFix: "",
      }),
      "kickoff",
    );
    expect(view).toEqual({
      title: "Full marks were reached.",
      body: null,
      steps: null,
      complete: true,
    });
  });

  it("turns the rapport 7/10 recommendation into an action plus outcome", () => {
    const view = presentQuickFix(
      dim({
        id: "d2",
        name: "Rapport & Tone",
        score: 7,
        maxScore: 10,
        quickFix:
          "Incorporate more personal stories or experiences that relate to the client's situation to enhance emotional connection.",
        evidence: [
          verified(
            "I had a rotator cuff thing last year that made me move like I was sixty-five",
          ),
        ],
        verifiedEvidenceCount: 1,
        evidenceFound: true,
        evidenceStrength: "medium",
      }),
      "kickoff",
    );
    expect(view?.complete).toBe(false);
    expect(view?.title).toBe("Deepen the personal connection");
    expect(view?.body).toMatch(/mirrors the client's situation/i);
    expect(view?.body).toMatch(/connect it back/i);
    expect(view?.steps).toBeNull();
  });

  it("anchors the close/recap 3/5 fix in a structured recap, not generic empathy", () => {
    const view = presentQuickFix(
      dim({
        id: "d11",
        name: "Close, Recap & Confidence",
        score: 3,
        maxScore: 5,
        quickFix:
          "Incorporate a more structured recap with emotional reinforcement to enhance the closing of the call.",
        rationale:
          "The recap referenced Lily and the climbing gym but stayed generic.",
        evidence: [
          verified("Lily at the climbing gym"),
        ],
        verifiedEvidenceCount: 1,
        evidenceFound: true,
        evidenceStrength: "medium",
      }),
      "kickoff",
    );
    expect(view?.title).toBe("Make the recap emotionally anchored");
    expect(view?.body).toMatch(/summarizing/i);
    expect(view?.steps).toEqual([
      "what the client wants",
      "why it matters emotionally",
      "what was agreed",
      "the next concrete step",
      "why that next step matters to the client's goal",
    ]);
  });

  it("does not ask for a recap when verified quotes already contain one", () => {
    const view = presentQuickFix(
      dim({
        id: "d11",
        name: "Close, Recap & Confidence",
        score: 3,
        maxScore: 5,
        quickFix:
          "Incorporate a more structured recap with emotional reinforcement to enhance the closing of the call.",
        rationale:
          "The recap referenced Lily and the climbing gym but stayed generic.",
        evidence: [
          verified(
            "Okay, let's do a quick recap before we hop off. Today we reconnected, and you shared something pretty real with me about Lily and the climbing gym, and that's our North Star now. Day thirty, our two markers are sitting through a full ninety-minute meeting.",
          ),
        ],
        verifiedEvidenceCount: 1,
        evidenceFound: true,
        evidenceStrength: "medium",
      }),
      "kickoff",
    );
    expect(view?.title).toMatch(/already in the transcript/i);
    expect(view?.steps).toBeNull();
    expect(view?.body).not.toMatch(/close by summarizing/i);
  });

  it("does not attach recap steps to a non-close dimension", () => {
    const view = presentQuickFix(
      dim({
        id: "d10",
        name: "Booking Next Call",
        score: 3,
        maxScore: 5,
        quickFix: "Get a verbal date and time for the next call before hanging up.",
      }),
      "kickoff",
    );
    expect(view?.title).not.toMatch(/recap/i);
    expect(view?.steps).toBeNull();
    expect(view?.body).toMatch(/verbal date/i);
  });

  it("does not make a coaching close into the kick-off recap checklist", () => {
    const view = presentQuickFix(
      dim({
        id: "d9",
        name: "Close Quality",
        score: 3,
        maxScore: 5,
        quickFix:
          "Celebrate something specific from this call, then point to what comes next.",
      }),
      "coaching",
    );
    expect(view?.title).toMatch(/celebrate something specific/i);
    expect(view?.steps).toBeNull();
    expect(view?.body).toMatch(/point to what comes next/i);
  });

  it("keeps a coaching check-in personal-share gap as a deepen-connection action", () => {
    const view = presentQuickFix(
      dim({
        id: "d1",
        name: "Check-In & Connection",
        score: 7,
        maxScore: 10,
        quickFix:
          "Share a personal story that relates to the client's situation to enhance emotional connection.",
      }),
      "coaching",
    );
    expect(view?.title).toBe("Deepen the personal connection");
    expect(view?.steps).toBeNull();
  });

  it("hides the box when the dimension is not scored", () => {
    expect(
      presentQuickFix(
        dim({
          id: "d4",
          name: "Movement Coaching Quality",
          score: null,
          maxScore: 15,
          quickFix: "",
          disabled: true,
        }),
        "coaching",
      ),
    ).toBeNull();
  });
});
