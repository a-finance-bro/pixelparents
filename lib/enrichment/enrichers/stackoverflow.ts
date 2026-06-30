// Stack Overflow enricher — KEYLESS (optional STACK_EXCHANGE_KEY only raises the
// quota). Resolves a user by a surfaced stackoverflow.com/users/<id> URL or by a
// reputation-sorted name search (corroborated by display name), then reports
// reputation, badges, and top tags.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { handleFromUrls, nameOverlaps } from "../identity";

const API = "https://api.stackexchange.com/2.3";

function key(): string {
  const k = process.env.STACK_EXCHANGE_KEY;
  return k ? `&key=${encodeURIComponent(k)}` : "";
}

type SoUser = {
  user_id?: number;
  display_name?: string;
  reputation?: number;
  badge_counts?: { gold?: number; silver?: number; bronze?: number };
  link?: string;
};
type SoResp<T> = { items?: T[] };

export async function enrichWithStackOverflow(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    let user: SoUser | null = null;
    const fromUrl = handleFromUrls(ctx.knownUrls.stackoverflow, /stackoverflow\.com\/users\/(\d+)/i);
    if (fromUrl) {
      const r = await fetchJson<SoResp<SoUser>>(
        `${API}/users/${fromUrl}?site=stackoverflow${key()}`,
      );
      user = r?.items?.[0] ?? null;
    }
    if (!user && ctx.fullName) {
      const r = await fetchJson<SoResp<SoUser>>(
        `${API}/users?inname=${encodeURIComponent(ctx.fullName)}&site=stackoverflow&order=desc&sort=reputation&pagesize=5${key()}`,
      );
      // A bare inname search matches impersonation/troll accounts that merely
      // contain the name tokens (e.g. "<Name> is a Nazi"). For an UNCONFIRMED
      // name-search match (no surfaced profile URL), require meaningful
      // reputation so a trivially-created account can't be attributed.
      const MIN_REP = 200;
      user =
        (r?.items ?? []).find(
          (u) => nameOverlaps(ctx.fullName, u.display_name) && (u.reputation ?? 0) >= MIN_REP,
        ) ?? null;
    }
    if (!user?.user_id) return noData("stackoverflow", "No matching Stack Overflow user");

    const b = user.badge_counts ?? {};
    const facts = [
      `Stack Overflow: ${user.display_name ?? "(user)"} — ${(user.reputation ?? 0).toLocaleString("en-US")} reputation (gold ${b.gold ?? 0}, silver ${b.silver ?? 0}, bronze ${b.bronze ?? 0}).`,
    ];
    const tags = await fetchJson<SoResp<{ tag_name?: string }>>(
      `${API}/users/${user.user_id}/top-tags?site=stackoverflow&pagesize=5${key()}`,
    );
    const tagNames = (tags?.items ?? []).map((t) => t.tag_name).filter(Boolean);
    if (tagNames.length) facts.push(`Top tags: ${tagNames.join(", ")}.`);

    return ok("stackoverflow", facts, [user.link ?? `https://stackoverflow.com/users/${user.user_id}`], {
      user_id: user.user_id,
      display_name: user.display_name,
      reputation: user.reputation,
      top_tags: tagNames,
    });
  } catch (e) {
    return errored("stackoverflow", `Stack Overflow lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
