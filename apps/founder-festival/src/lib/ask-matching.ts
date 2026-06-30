// Ask → expertise matcher (OHS connect-mode connector, feat/ff-asks-connector).
//
// PURE + DB-FREE core so it's trivially unit-testable. Given an ask's expertise
// tags and a list of candidate HELPER profiles, rank candidates by how well
// their expertise overlaps the ask. Deterministic and keyless — NO AI / scoring
// spend in v1. The data-access seam (loading candidates) lives in the route
// handler; this module only does the ranking math, so the same function powers
// both the ask-detail page and the unit tests.
//
// Later, an AI matcher can wrap or replace `rankCandidates` without changing the
// call sites: keep this signature (ask tags + candidates → ranked matches) as
// the stable seam.

import { normalizeMemberType, type MemberType } from "./member-type";

// A candidate helper, projected from an `evaluations` row joined to its `users`
// claim. Only the fields the matcher needs — keeps the core decoupled from the
// DB schema. `expertiseTags` are canonical industry slugs
// (evaluations.canonical_industries). `factCount` is a cheap richness proxy
// (e.g. number of enrichment facts) used only as a deterministic tiebreak.
export type HelperCandidate = {
  evaluationId: string;
  clerkUserId: string;
  fullName: string | null;
  memberType: MemberType | string | null;
  expertiseTags: string[];
  // Higher = richer profile. Used only to break score ties deterministically.
  factCount: number;
};

// A ranked match returned to the UI. `overlapTags` are the exact tags the
// candidate shares with the ask (drives the "matched on: X, Y" chips), `score`
// is the overlap count (the primary ranking key).
export type AskMatch = {
  evaluationId: string;
  clerkUserId: string;
  fullName: string | null;
  score: number;
  overlapTags: string[];
};

export type RankOptions = {
  // The ask's expertise tags (canonical slugs).
  askTags: string[];
  // Candidate helper pool.
  candidates: HelperCandidate[];
  // The asker's own evaluation id, excluded from results (you can't be matched
  // to yourself). Null when unknown (nothing excluded).
  excludeEvaluationId?: string | null;
  // Max matches to return. Defaults to 10.
  limit?: number;
};

// Lowercase + trim + dedupe a tag list into a Set for overlap math. Empty and
// non-string entries are dropped.
function normalizeTagSet(tags: readonly (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const v = t.trim().toLowerCase();
    if (v) out.add(v);
  }
  return out;
}

// Rank candidate helpers for an ask by expertise-tag overlap.
//
// Rules (all deterministic):
//   1. Exclude students (they SEEK, they don't HELP).
//   2. Exclude the asker themselves.
//   3. Score = number of ask tags the candidate also has (case-insensitive).
//   4. Drop zero-overlap candidates (no shared expertise = not a match).
//   5. Sort by score desc, then factCount desc (richer profile wins ties),
//      then fullName asc, then evaluationId asc — fully stable, no randomness.
//   6. Cap at `limit` (default 10).
//
// If the ask has no tags, nothing matches (returns []), since overlap is the
// only v1 signal.
export function rankCandidates(opts: RankOptions): AskMatch[] {
  const { askTags, candidates, excludeEvaluationId = null, limit = 10 } = opts;
  const askSet = normalizeTagSet(askTags);
  if (askSet.size === 0) return [];

  const matches: AskMatch[] = [];
  for (const c of candidates) {
    if (c.evaluationId === excludeEvaluationId) continue;
    // Students don't help.
    if (normalizeMemberType(c.memberType) === "student") continue;

    const candSet = normalizeTagSet(c.expertiseTags);
    // Preserve the ask's tag order in overlapTags for stable UI display.
    const overlapTags: string[] = [];
    for (const tag of askSet) {
      if (candSet.has(tag)) overlapTags.push(tag);
    }
    if (overlapTags.length === 0) continue;

    matches.push({
      evaluationId: c.evaluationId,
      clerkUserId: c.clerkUserId,
      fullName: c.fullName,
      score: overlapTags.length,
      overlapTags,
    });
  }

  // Build a factCount lookup for the tiebreak (kept off AskMatch to keep the
  // returned shape lean).
  const factCountById = new Map(candidates.map((c) => [c.evaluationId, c.factCount]));

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = factCountById.get(a.evaluationId) ?? 0;
    const fb = factCountById.get(b.evaluationId) ?? 0;
    if (fb !== fa) return fb - fa;
    const na = a.fullName ?? "";
    const nb = b.fullName ?? "";
    if (na !== nb) return na.localeCompare(nb);
    return a.evaluationId.localeCompare(b.evaluationId);
  });

  return matches.slice(0, Math.max(0, limit));
}
