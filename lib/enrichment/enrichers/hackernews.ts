// Hacker News enricher — KEYLESS. Resolves an HN handle (from a surfaced
// news.ycombinator.com/user URL, or a name/github-derived candidate corroborated
// by the bio) and reports karma, account age, and top posts via the Firebase +
// Algolia public APIs.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { deriveHandleCandidates, handleFromUrls } from "../identity";

const FIREBASE = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA = "https://hn.algolia.com/api/v1";

type HnUser = { id?: string; karma?: number; created?: number; about?: string };
type AlgoliaResp = {
  nbHits?: number;
  hits?: Array<{ title?: string; points?: number; num_comments?: number; objectID?: string }>;
};

async function hnUser(id: string): Promise<HnUser | null> {
  return fetchJson<HnUser>(`${FIREBASE}/user/${encodeURIComponent(id)}.json`);
}

// Does the bio contain the subject's name tokens? Light corroboration for a
// guessed handle.
function bioCorroborates(fullName: string | null, about: string | undefined): boolean {
  if (!about || !fullName) return false;
  const lower = about.toLowerCase();
  return fullName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).every((t) => lower.includes(t));
}

async function resolveHandle(ctx: EnricherContext): Promise<HnUser | null> {
  const fromUrl = handleFromUrls(ctx.knownUrls.hackernews, /news\.ycombinator\.com\/user\?id=([\w-]+)/i);
  if (fromUrl) {
    const u = await hnUser(fromUrl);
    if (u?.id) return u; // surfaced URL is trusted
  }
  for (const cand of deriveHandleCandidates(ctx)) {
    const u = await hnUser(cand);
    if (u?.id && bioCorroborates(ctx.fullName, u.about)) return u;
  }
  return null;
}

export async function enrichWithHackerNews(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const user = await resolveHandle(ctx);
    if (!user?.id) return noData("hackernews", "No corroborated HN account found");

    const facts: string[] = [];
    const years = user.created
      ? Math.floor((Date.now() / 1000 - user.created) / (365 * 86400))
      : null;
    facts.push(
      `Hacker News: @${user.id} — ${user.karma ?? 0} karma${years != null ? `, account ~${years}y old` : ""}.`,
    );

    const stories = await fetchJson<AlgoliaResp>(
      `${ALGOLIA}/search?tags=author_${encodeURIComponent(user.id)},story&hitsPerPage=100`,
    );
    const comments = await fetchJson<AlgoliaResp>(
      `${ALGOLIA}/search?tags=author_${encodeURIComponent(user.id)},comment&hitsPerPage=1`,
    );
    if (stories?.nbHits != null || comments?.nbHits != null) {
      facts.push(`${stories?.nbHits ?? 0} posts / ${comments?.nbHits ?? 0} comments on HN.`);
    }
    const citations = [`https://news.ycombinator.com/user?id=${user.id}`];
    const topPosts = (stories?.hits ?? [])
      .filter((h) => (h.points ?? 0) > 0)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 3);
    for (const p of topPosts) {
      facts.push(`  • "${p.title ?? "(untitled)"}" — ${p.points ?? 0} points, ${p.num_comments ?? 0} comments.`);
      if (p.objectID) citations.push(`https://news.ycombinator.com/item?id=${p.objectID}`);
    }
    if (user.about) facts.push(`HN bio: "${user.about.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200)}".`);

    return ok("hackernews", facts, citations, {
      handle: user.id,
      karma: user.karma,
      posts: stories?.nbHits,
      comments: comments?.nbHits,
    });
  } catch (e) {
    return errored("hackernews", `HN lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
