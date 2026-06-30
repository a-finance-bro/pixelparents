// DB-access layer for the OHS "asks → expertise" connector
// (feat/ff-asks-connector). The PURE ranking math lives in ask-matching.ts;
// this module loads/writes rows and adapts them into the matcher's shapes.
// Gated behind CONNECT_MODE at the route/page level — this module itself is
// flag-agnostic so it stays unit-testable against a DB.

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { asks, askResponses, evaluations, users } from "@/db/schema";
import {
  rankCandidates,
  type AskMatch,
  type HelperCandidate,
} from "./ask-matching";
import { profileUrlFor } from "./profile-slug";
import {
  ASK_PROPOSALS,
  ASK_PROPOSAL_LABELS,
  type AskStatus,
  type ResponseProposal,
  type ResponseStatus,
} from "./ask-constants";

// Re-export the DB-free constants so existing `@/lib/asks` import sites keep
// working (the source of truth now lives in ask-constants.ts).
export {
  ASK_PROPOSALS,
  ASK_PROPOSAL_LABELS,
  type AskStatus,
  type ResponseProposal,
  type ResponseStatus,
};

// Resolve the signed-in Clerk user to their claimed profile. Returns null when
// the user has no `users` row or hasn't claimed an evaluation (can't post/respond).
export async function getClaimedUserByClerkId(
  clerkUserId: string,
): Promise<{ evaluationId: string; memberType: string } | null> {
  const [row] = await db
    .select({ evaluationId: users.evaluationId, memberType: users.memberType })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (!row?.evaluationId) return null;
  return { evaluationId: row.evaluationId, memberType: row.memberType };
}

// A board row: an ask plus its author's display name and a live offer count.
export type AskBoardRow = {
  id: string;
  title: string;
  body: string;
  expertiseTags: string[];
  status: AskStatus;
  authorEvaluationId: string;
  authorName: string | null;
  authorProfileHref: string;
  offerCount: number;
  createdAt: Date;
};

// List open asks newest-first, optionally filtered to those tagged with ANY of
// `industries` (array overlap, same semantics as the directory facet filter).
export async function listOpenAsks(industries: string[] = []): Promise<AskBoardRow[]> {
  const where =
    industries.length > 0
      ? and(eq(asks.status, "open"), sql`${asks.expertiseTags} && ${industries}`)
      : eq(asks.status, "open");

  const rows = await db
    .select({
      id: asks.id,
      title: asks.title,
      body: asks.body,
      expertiseTags: asks.expertiseTags,
      status: asks.status,
      authorEvaluationId: asks.authorEvaluationId,
      authorName: evaluations.fullName,
      authorSlug: evaluations.slug,
      authorSlugKind: evaluations.slugKind,
      authorClerkUsername: users.clerkUsername,
      createdAt: asks.createdAt,
    })
    .from(asks)
    .innerJoin(evaluations, eq(evaluations.id, asks.authorEvaluationId))
    .leftJoin(users, eq(users.evaluationId, asks.authorEvaluationId))
    .where(where)
    .orderBy(desc(asks.createdAt))
    .limit(200);

  if (rows.length === 0) return [];

  // One grouped query for offer counts across the listed asks.
  const counts = await db
    .select({ askId: askResponses.askId, n: sql<number>`count(*)::int` })
    .from(askResponses)
    .groupBy(askResponses.askId);
  const countById = new Map(counts.map((c) => [c.askId, c.n]));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    expertiseTags: r.expertiseTags,
    status: r.status as AskStatus,
    authorEvaluationId: r.authorEvaluationId,
    authorName: r.authorName,
    authorProfileHref: profileUrlFor({
      evalId: r.authorEvaluationId,
      slug: r.authorSlug,
      slugKind: r.authorSlugKind,
      clerkUsername: r.authorClerkUsername,
    }),
    offerCount: countById.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
}

export type AskDetail = {
  id: string;
  title: string;
  body: string;
  expertiseTags: string[];
  status: AskStatus;
  authorEvaluationId: string;
  authorClerkUserId: string;
  authorName: string | null;
  authorProfileHref: string;
  createdAt: Date;
};

export async function getAsk(id: string): Promise<AskDetail | null> {
  const [r] = await db
    .select({
      id: asks.id,
      title: asks.title,
      body: asks.body,
      expertiseTags: asks.expertiseTags,
      status: asks.status,
      authorEvaluationId: asks.authorEvaluationId,
      authorClerkUserId: asks.authorClerkUserId,
      authorName: evaluations.fullName,
      authorSlug: evaluations.slug,
      authorSlugKind: evaluations.slugKind,
      authorClerkUsername: users.clerkUsername,
      createdAt: asks.createdAt,
    })
    .from(asks)
    .innerJoin(evaluations, eq(evaluations.id, asks.authorEvaluationId))
    .leftJoin(users, eq(users.evaluationId, asks.authorEvaluationId))
    .where(eq(asks.id, id))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    expertiseTags: r.expertiseTags,
    status: r.status as AskStatus,
    authorEvaluationId: r.authorEvaluationId,
    authorClerkUserId: r.authorClerkUserId,
    authorName: r.authorName,
    authorProfileHref: profileUrlFor({
      evalId: r.authorEvaluationId,
      slug: r.authorSlug,
      slugKind: r.authorSlugKind,
      clerkUsername: r.authorClerkUsername,
    }),
    createdAt: r.createdAt,
  };
}

export type AskResponseRow = {
  id: string;
  responderEvaluationId: string;
  responderClerkUserId: string;
  responderName: string | null;
  responderProfileHref: string;
  offer: string;
  proposes: ResponseProposal;
  status: ResponseStatus;
  createdAt: Date;
};

// All responses to an ask, newest first. The asker sees these to accept/decline.
export async function listAskResponses(askId: string): Promise<AskResponseRow[]> {
  const rows = await db
    .select({
      id: askResponses.id,
      responderEvaluationId: askResponses.responderEvaluationId,
      responderClerkUserId: askResponses.responderClerkUserId,
      responderName: evaluations.fullName,
      responderSlug: evaluations.slug,
      responderSlugKind: evaluations.slugKind,
      responderClerkUsername: users.clerkUsername,
      offer: askResponses.offer,
      proposes: askResponses.proposes,
      status: askResponses.status,
      createdAt: askResponses.createdAt,
    })
    .from(askResponses)
    .innerJoin(evaluations, eq(evaluations.id, askResponses.responderEvaluationId))
    .leftJoin(users, eq(users.evaluationId, askResponses.responderEvaluationId))
    .where(eq(askResponses.askId, askId))
    .orderBy(desc(askResponses.createdAt));

  return rows.map((r) => ({
    id: r.id,
    responderEvaluationId: r.responderEvaluationId,
    responderClerkUserId: r.responderClerkUserId,
    responderName: r.responderName,
    responderProfileHref: profileUrlFor({
      evalId: r.responderEvaluationId,
      slug: r.responderSlug,
      slugKind: r.responderSlugKind,
      clerkUsername: r.responderClerkUsername,
    }),
    offer: r.offer,
    proposes: r.proposes as ResponseProposal,
    status: r.status as ResponseStatus,
    createdAt: r.createdAt,
  }));
}

// Load + rank candidate helpers for an ask. Pulls claimed, non-hidden profiles
// whose claim is non-student, projects them into HelperCandidate, and defers all
// ranking to the pure matcher. Excludes the asker. Skips DB work entirely when
// the ask has no tags (the matcher would return [] anyway).
export async function getSuggestedHelpers(
  ask: Pick<AskDetail, "id" | "expertiseTags" | "authorEvaluationId">,
  limit = 10,
): Promise<AskMatch[]> {
  if (ask.expertiseTags.length === 0) return [];

  // Only CLAIMED profiles (a users row with an evaluation) can be helpers — an
  // unclaimed profile has nobody to receive the offer. Exclude students and the
  // asker. Narrow to profiles sharing at least one tag via array-overlap so we
  // don't pull the whole directory.
  const rows = await db
    .select({
      evaluationId: evaluations.id,
      clerkUserId: users.clerkUserId,
      fullName: evaluations.fullName,
      memberType: users.memberType,
      expertiseTags: evaluations.canonicalIndustries,
      credibilityTitle: evaluations.credibilityTitle,
    })
    .from(users)
    .innerJoin(evaluations, eq(evaluations.id, users.evaluationId))
    .where(
      and(
        ne(users.memberType, "student"),
        ne(evaluations.id, ask.authorEvaluationId),
        sql`${evaluations.canonicalIndustries} && ${ask.expertiseTags}`,
        sql`${evaluations.hiddenAt} is null`,
      ),
    )
    .limit(200);

  const candidates: HelperCandidate[] = rows.map((r) => ({
    evaluationId: r.evaluationId,
    clerkUserId: r.clerkUserId,
    fullName: r.fullName,
    memberType: r.memberType,
    expertiseTags: r.expertiseTags ?? [],
    // Cheap, DB-side richness proxy: number of canonical tags + a small bonus
    // for having an LLM headline. Avoids JSON-parsing the profile blob.
    factCount: (r.expertiseTags?.length ?? 0) + (r.credibilityTitle ? 1 : 0),
  }));

  return rankCandidates({
    askTags: ask.expertiseTags,
    candidates,
    excludeEvaluationId: ask.authorEvaluationId,
    limit,
  });
}
