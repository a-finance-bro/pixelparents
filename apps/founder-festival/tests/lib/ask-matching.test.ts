import { describe, it, expect } from "vitest";
import { rankCandidates, type HelperCandidate } from "@/lib/ask-matching";

// Build a candidate with sensible defaults so each test only sets what it cares
// about.
function cand(over: Partial<HelperCandidate> & { evaluationId: string }): HelperCandidate {
  return {
    clerkUserId: `clerk_${over.evaluationId}`,
    fullName: over.evaluationId,
    memberType: "parent",
    expertiseTags: [],
    factCount: 0,
    ...over,
  };
}

describe("rankCandidates", () => {
  it("returns [] when the ask has no tags", () => {
    const out = rankCandidates({
      askTags: [],
      candidates: [cand({ evaluationId: "a", expertiseTags: ["fintech"] })],
    });
    expect(out).toEqual([]);
  });

  it("returns [] when no candidate overlaps", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "a", expertiseTags: ["fintech"] }),
        cand({ evaluationId: "b", expertiseTags: ["crypto", "ai-ml"] }),
      ],
    });
    expect(out).toEqual([]);
  });

  it("scores by number of overlapping tags and surfaces the overlap", () => {
    const out = rankCandidates({
      askTags: ["edtech", "fintech"],
      candidates: [
        cand({ evaluationId: "one", expertiseTags: ["edtech"] }),
        cand({ evaluationId: "two", expertiseTags: ["edtech", "fintech", "crypto"] }),
      ],
    });
    expect(out.map((m) => m.evaluationId)).toEqual(["two", "one"]);
    expect(out[0]!.score).toBe(2);
    expect(out[0]!.overlapTags).toEqual(["edtech", "fintech"]);
    expect(out[1]!.score).toBe(1);
    expect(out[1]!.overlapTags).toEqual(["edtech"]);
  });

  it("excludes students even with a perfect tag match", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "student", memberType: "student", expertiseTags: ["edtech"] }),
        cand({ evaluationId: "parent", memberType: "parent", expertiseTags: ["edtech"] }),
      ],
    });
    expect(out.map((m) => m.evaluationId)).toEqual(["parent"]);
  });

  it("treats unknown/empty memberType as a helper (default community)", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "x", memberType: null, expertiseTags: ["edtech"] }),
        cand({ evaluationId: "y", memberType: "garbage", expertiseTags: ["edtech"] }),
      ],
    });
    expect(out.map((m) => m.evaluationId).sort()).toEqual(["x", "y"]);
  });

  it("excludes the asker themselves", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "me", expertiseTags: ["edtech"] }),
        cand({ evaluationId: "you", expertiseTags: ["edtech"] }),
      ],
      excludeEvaluationId: "me",
    });
    expect(out.map((m) => m.evaluationId)).toEqual(["you"]);
  });

  it("matches tags case-insensitively", () => {
    const out = rankCandidates({
      askTags: ["EdTech", "  Fintech  "],
      candidates: [cand({ evaluationId: "a", expertiseTags: ["EDTECH", "fintech"] })],
    });
    expect(out[0]!.score).toBe(2);
  });

  it("breaks score ties by factCount (richer profile first)", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "lean", expertiseTags: ["edtech"], factCount: 1, fullName: "Zed" }),
        cand({ evaluationId: "rich", expertiseTags: ["edtech"], factCount: 9, fullName: "Amy" }),
      ],
    });
    expect(out.map((m) => m.evaluationId)).toEqual(["rich", "lean"]);
  });

  it("breaks factCount ties by fullName then evaluationId (deterministic)", () => {
    const out = rankCandidates({
      askTags: ["edtech"],
      candidates: [
        cand({ evaluationId: "b", expertiseTags: ["edtech"], factCount: 3, fullName: "Sam" }),
        cand({ evaluationId: "a", expertiseTags: ["edtech"], factCount: 3, fullName: "Sam" }),
        cand({ evaluationId: "c", expertiseTags: ["edtech"], factCount: 3, fullName: "Alex" }),
      ],
    });
    // Alex sorts before Sam; among the two Sams, evaluationId "a" before "b".
    expect(out.map((m) => m.evaluationId)).toEqual(["c", "a", "b"]);
  });

  it("respects the limit", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      cand({ evaluationId: `e${i}`, expertiseTags: ["edtech"], factCount: i }),
    );
    const out = rankCandidates({ askTags: ["edtech"], candidates, limit: 2 });
    expect(out).toHaveLength(2);
    // Highest factCount first.
    expect(out.map((m) => m.evaluationId)).toEqual(["e4", "e3"]);
  });

  it("ignores duplicate/blank tags on both sides", () => {
    const out = rankCandidates({
      askTags: ["edtech", "edtech", "", "  "],
      candidates: [cand({ evaluationId: "a", expertiseTags: ["edtech", "edtech", ""] })],
    });
    expect(out[0]!.score).toBe(1);
    expect(out[0]!.overlapTags).toEqual(["edtech"]);
  });
});
