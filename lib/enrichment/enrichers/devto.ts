// dev.to enricher — KEYLESS (Forem public read API). Resolves a username from a
// known github/twitter handle or a name-derived candidate (corroborated by the
// profile's linked github/twitter or name), then reports article + reaction
// counts and top tags.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { deriveHandleCandidates, nameOverlaps } from "../identity";

const API = "https://dev.to/api";

type DevUser = {
  username?: string;
  name?: string;
  github_username?: string;
  twitter_username?: string;
};
type Article = {
  title?: string;
  url?: string;
  positive_reactions_count?: number;
  comments_count?: number;
  tag_list?: string[];
  published_at?: string;
};

export async function enrichWithDevto(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const ghHandle = ctx.githubUsername?.toLowerCase() ?? null;
    let user: DevUser | null = null;
    for (const cand of deriveHandleCandidates(ctx)) {
      const u = await fetchJson<DevUser>(`${API}/users/by_username?url=${encodeURIComponent(cand)}`);
      if (!u?.username) continue;
      const confident =
        (ghHandle && u.github_username?.toLowerCase() === ghHandle) ||
        nameOverlaps(ctx.fullName, u.name);
      if (confident) {
        user = u;
        break;
      }
    }
    if (!user?.username) return noData("devto", "No corroborated dev.to account");

    const articles =
      (await fetchJson<Article[]>(`${API}/articles?username=${encodeURIComponent(user.username)}&per_page=30`)) ?? [];
    if (articles.length === 0) return noData("devto", "dev.to account has no published articles");

    const reactions = articles.reduce((s, a) => s + (a.positive_reactions_count ?? 0), 0);
    const comments = articles.reduce((s, a) => s + (a.comments_count ?? 0), 0);
    const top = [...articles].sort(
      (a, b) => (b.positive_reactions_count ?? 0) - (a.positive_reactions_count ?? 0),
    )[0];
    const tagFreq = new Map<string, number>();
    for (const a of articles) for (const t of a.tag_list ?? []) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
    const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);

    const facts = [
      `Publishes on dev.to as @${user.username}${user.name ? ` (${user.name})` : ""}.`,
      `${articles.length} articles on dev.to (${reactions} total reactions, ${comments} comments).`,
    ];
    if (top?.title) facts.push(`Top article: "${top.title}" (${top.positive_reactions_count ?? 0} reactions).`);
    if (topTags.length) facts.push(`Frequent tags: ${topTags.join(", ")}.`);

    const citations = [`https://dev.to/${user.username}`];
    if (top?.url) citations.push(top.url);
    return ok("devto", facts, citations, {
      username: user.username,
      article_count: articles.length,
      reactions,
      top_tags: topTags,
    });
  } catch (e) {
    return errored("devto", `dev.to lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
