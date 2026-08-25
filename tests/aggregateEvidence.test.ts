import { describe, expect, it } from "vitest";
import {
  aggregateEvidencePacks,
  formatAggregatedEvidence,
  type ChunkEvidencePack,
} from "@/lib/ai/aggregateEvidence";

describe("aggregateEvidencePacks", () => {
  it("groups by dimension, dedupes quotes, and caps per dimension", () => {
    const packs: ChunkEvidencePack[] = [
      {
        chunkIndex: 0,
        findings: [
          {
            dimensionId: "d1",
            quotes: [
              {
                quote: "you do not need to repeat all of that for me",
                speaker: "Dana Whitlock",
                location: null,
              },
            ],
            observations: "Coach references prior notes.",
          },
        ],
      },
      {
        chunkIndex: 1,
        findings: [
          {
            dimensionId: "d1",
            quotes: [
              {
                quote: "you do not need to repeat all of that for me",
                speaker: "Dana Whitlock",
                location: null,
              },
              {
                quote: "I reviewed your intake form before we started",
                speaker: "Dana Whitlock",
                location: null,
              },
            ],
            observations: "Overlap chunk — duplicate quote.",
          },
        ],
      },
    ];

    const aggregated = aggregateEvidencePacks(packs, 5);
    const d1 = aggregated.find((d) => d.dimensionId === "d1");
    expect(d1).toBeDefined();
    expect(d1!.quotes).toHaveLength(2);
    expect(d1!.observations.length).toBeGreaterThanOrEqual(1);
    expect(formatAggregatedEvidence(aggregated)).toContain("d1");
  });

  it("preserves chunk order for quotes", () => {
    const packs: ChunkEvidencePack[] = [
      {
        chunkIndex: 2,
        findings: [
          {
            dimensionId: "d4",
            quotes: [{ quote: "second chunk quote here", speaker: null, location: null }],
            observations: "",
          },
        ],
      },
      {
        chunkIndex: 0,
        findings: [
          {
            dimensionId: "d4",
            quotes: [{ quote: "first chunk quote here ok", speaker: null, location: null }],
            observations: "",
          },
        ],
      },
    ];

    const aggregated = aggregateEvidencePacks(packs);
    const d4 = aggregated.find((d) => d.dimensionId === "d4")!;
    expect(d4.quotes[0]!.chunkIndex).toBe(0);
    expect(d4.quotes[1]!.chunkIndex).toBe(2);
  });

  it("deduplicates identical quotes from different chunks", () => {
    const packs: ChunkEvidencePack[] = [
      {
        chunkIndex: 0,
        findings: [
          {
            dimensionId: "d6",
            quotes: [
              {
                quote: "You are training to be Lily's belay partner",
                speaker: "Dana Whitlock",
                location: null,
              },
            ],
            observations: "",
          },
        ],
      },
      {
        chunkIndex: 3,
        findings: [
          {
            dimensionId: "d6",
            quotes: [
              {
                quote: "you are training to be lily's belay partner",
                speaker: "Dana Whitlock",
                location: null,
              },
            ],
            observations: "",
          },
        ],
      },
    ];

    const aggregated = aggregateEvidencePacks(packs);
    const d6 = aggregated.find((d) => d.dimensionId === "d6")!;
    expect(d6.quotes).toHaveLength(1);
  });

  it("never invents quotes during aggregation", () => {
    const packs: ChunkEvidencePack[] = [
      {
        chunkIndex: 0,
        findings: [
          {
            dimensionId: "d2",
            quotes: [
              { quote: "only quote that exists in the pack", speaker: null, location: null },
            ],
            observations: "none found in this chunk for other behaviours",
          },
        ],
      },
    ];
    const aggregated = aggregateEvidencePacks(packs);
    const quotes = aggregated.flatMap((d) => d.quotes.map((q) => q.quote));
    expect(quotes).toEqual(["only quote that exists in the pack"]);
    expect(quotes.some((q) => /invent|fabricat/i.test(q))).toBe(false);
  });
});
