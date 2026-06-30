// Libraries.io enricher — KEYED (LIBRARIESIO_API_KEY). Returns fast with
// "no_api_key" when absent. Reports SourceRank (composite OSS-reputation) for the
// subject's GitHub repos, keyed off the confirmed GitHub login (no new identity
// surface).

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchJson } from "../http";
import { handleFromUrls } from "../identity";

const BASE = "https://libraries.io/api";

type Repo = { full_name?: string; rank?: number; stargazers_count?: number; fork?: boolean };

export async function enrichWithLibrariesIo(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.LIBRARIESIO_API_KEY;
  if (!key) return noApiKey("librariesio");
  try {
    const login =
      ctx.githubUsername?.trim() ||
      handleFromUrls(ctx.knownUrls.github, /github\.com\/([A-Za-z0-9-]+)/i);
    if (!login) return noData("librariesio", "No GitHub login to query");

    const repos =
      (await fetchJson<Repo[]>(
        `${BASE}/github/${encodeURIComponent(login)}/repositories?per_page=10&sort=rank&api_key=${encodeURIComponent(key)}`,
      )) ?? [];
    const ranked = repos.filter((r) => !r.fork && (r.rank ?? 0) > 0).sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
    if (ranked.length === 0) return noData("librariesio", "No ranked repos on Libraries.io");

    const maxRank = ranked[0]!.rank ?? 0;
    const facts = [
      `Libraries.io indexed ${ranked.length} non-fork repo(s) for @${login}; top SourceRank ${maxRank} (composite OSS-reputation score).`,
    ];
    const citations: string[] = [];
    for (const r of ranked.slice(0, 5)) {
      facts.push(`  • ${r.full_name} — SourceRank ${r.rank}, ${r.stargazers_count ?? 0}★.`);
      if (r.full_name) citations.push(`https://libraries.io/github/${r.full_name}`);
    }
    return ok("librariesio", facts, citations, { login, repo_count: ranked.length, max_sourcerank: maxRank });
  } catch (e) {
    return errored("librariesio", `Libraries.io lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
