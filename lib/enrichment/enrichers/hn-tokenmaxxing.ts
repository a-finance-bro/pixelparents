// HN Tokenmaxxing enricher — KEYLESS. Checks the public tkmx.odio.dev leaderboard
// (active heavy LLM users) for the subject by GitHub-/name-derived handle or a
// surfaced HN handle. Reports listed tools/projects.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { deriveHandleCandidates, handleFromUrls } from "../identity";

const USERS = "https://tkmx.odio.dev/api/users";

type TkmxUser = {
  username?: string;
  hn_username?: string;
  tools?: string[];
  projects?: string[];
};

export async function enrichWithHnTokenmaxxing(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const users = await fetchJson<TkmxUser[]>(USERS);
    if (!Array.isArray(users) || users.length === 0) {
      return noData("hn-tokenmaxxing", "Leaderboard unavailable or empty");
    }

    const hnFromUrl = handleFromUrls(
      ctx.knownUrls.hackernews,
      /news\.ycombinator\.com\/user\?id=([\w-]+)/i,
    );
    const candidates = new Set(
      [hnFromUrl, ...deriveHandleCandidates(ctx)].filter(Boolean).map((c) => c!.toLowerCase()),
    );

    const match = users.find(
      (u) =>
        (u.username && candidates.has(u.username.toLowerCase())) ||
        (u.hn_username && candidates.has(u.hn_username.toLowerCase())),
    );
    if (!match?.username) return noData("hn-tokenmaxxing", "Not on the Tokenmaxxing leaderboard");

    const facts = [
      `Listed on the HN Tokenmaxxing leaderboard as @${match.username}${match.hn_username ? ` (HN @${match.hn_username})` : ""} — an active heavy LLM/AI-tooling user.`,
    ];
    if (match.tools?.length) facts.push(`Reported tools: ${match.tools.slice(0, 8).join(", ")}.`);
    if (match.projects?.length) facts.push(`Projects: ${match.projects.slice(0, 6).join(", ")}.`);

    return ok("hn-tokenmaxxing", facts, [`https://tkmx.odio.dev/${match.username}`], {
      username: match.username,
      hn_username: match.hn_username,
    });
  } catch (e) {
    return errored("hn-tokenmaxxing", `Tokenmaxxing lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
