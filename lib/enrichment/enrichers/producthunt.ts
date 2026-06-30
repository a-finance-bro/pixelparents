// Product Hunt enricher — KEYED (PRODUCT_HUNT_TOKEN, Bearer for the v2 GraphQL
// API). Returns fast with "no_api_key" when absent. Searches makers by name and
// reports their product launches.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchWithTimeout, USER_AGENT } from "../http";
import { nameOverlaps } from "../identity";

const GQL = "https://api.producthunt.com/v2/api/graphql";

type PhUser = {
  name?: string;
  username?: string;
  url?: string;
  headline?: string;
  madePosts?: { totalCount?: number; edges?: Array<{ node?: PhPost }> };
};
type PhPost = { name?: string; tagline?: string; votesCount?: number; featuredAt?: string; url?: string };

export async function enrichWithProductHunt(ctx: EnricherContext): Promise<EnrichmentResult> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) return noApiKey("producthunt");
  try {
    if (!ctx.fullName) return noData("producthunt", "No subject name to search");
    const query = `query Search($q:String!){ search(query:$q, types:USER, first:5){ edges{ node{ ...on User{ name username url headline madePosts(first:10){ totalCount edges{ node{ name tagline votesCount featuredAt url } } } } } } } }`;
    const res = await fetchWithTimeout(GQL, {
      method: "POST",
      headers: {
        "user-agent": USER_AGENT,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables: { q: ctx.fullName } }),
    });
    if (!res || !res.ok) return errored("producthunt", `Product Hunt HTTP ${res?.status ?? "error"}`);
    const data = (await res.json()) as {
      data?: { search?: { edges?: Array<{ node?: PhUser }> } };
    };
    const users = (data?.data?.search?.edges ?? []).map((e) => e.node).filter(Boolean) as PhUser[];
    const best = users.find((u) => nameOverlaps(ctx.fullName, u.name));
    if (!best) return noData("producthunt", "No matching Product Hunt maker");

    const posts = (best.madePosts?.edges ?? []).map((e) => e.node).filter(Boolean) as PhPost[];
    const featured = posts.filter((p) => p.featuredAt).length;
    const top = [...posts].sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0)).slice(0, 3);

    const facts = [
      `Product Hunt: @${best.username}${best.name ? ` (${best.name})` : ""}${best.headline ? ` — ${best.headline}` : ""}.`,
      `Maker of ${best.madePosts?.totalCount ?? posts.length} launch(es) (${featured} featured on PH homepage).`,
    ];
    const citations = best.url ? [best.url] : [];
    for (const p of top) {
      facts.push(`  • ${p.name} — ${p.tagline ?? ""} (${p.votesCount ?? 0} upvotes${p.featuredAt ? " · FEATURED" : ""})`);
      if (p.url) citations.push(p.url);
    }
    return ok("producthunt", facts, citations, {
      username: best.username,
      launch_count: best.madePosts?.totalCount ?? posts.length,
      featured,
    });
  } catch (e) {
    return errored("producthunt", `Product Hunt lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
