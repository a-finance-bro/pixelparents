// GitHub enricher — re-implemented from the donor's github.ts. KEYLESS-capable:
// the public REST API works unauthenticated (60 req/hr); if GITHUB_ADMIN_TOKEN is
// set the limit rises to 5,000/hr AND the GraphQL contribution graph becomes
// available. Pixelparents stores the parent's GitHub username on the signup, so
// (unlike the donor) we usually have a CONFIRMED handle and don't have to guess.
//
// Status contract:
//   no_data — no resolvable/confirmed GitHub account for the subject.
//   ok      — found the account and built facts.
//   error   — unexpected throw.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson, fetchWithTimeout, USER_AGENT } from "../http";
import { deriveHandleCandidates, handleFromUrls, nameOverlaps } from "../identity";

const GH_API = "https://api.github.com";

function token(): string | undefined {
  return process.env.GITHUB_ADMIN_TOKEN || process.env.GITHUB_TOKEN || undefined;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "application/vnd.github+json",
  };
  const t = token();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
}

type GhUser = {
  login: string;
  name?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  public_repos?: number;
  followers?: number;
  created_at?: string;
};
type GhRepo = {
  name: string;
  html_url: string;
  stargazers_count?: number;
  description?: string | null;
  language?: string | null;
  fork?: boolean;
  pushed_at?: string;
};

async function ghUser(login: string): Promise<GhUser | null> {
  return fetchJson<GhUser>(`${GH_API}/users/${encodeURIComponent(login)}`, {
    headers: ghHeaders(),
  });
}

// GraphQL contribution graph — requires a token; no-ops (null) without one.
type Contributions = {
  lastYearTotal: number;
  commits: number;
  pullRequests: number;
  reviews: number;
  reposContributedTo: number;
};
async function fetchContributions(login: string): Promise<Contributions | null> {
  if (!token()) return null;
  const query = `query { user(login: ${JSON.stringify(login)}) {
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
    repositoriesContributedTo(includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW]) { totalCount }
  } }`;
  const res = await fetchWithTimeout(`${GH_API}/graphql`, {
    method: "POST",
    headers: { ...ghHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as {
      data?: {
        user?: {
          contributionsCollection?: {
            contributionCalendar?: { totalContributions?: number };
            totalCommitContributions?: number;
            totalPullRequestContributions?: number;
            totalPullRequestReviewContributions?: number;
          };
          repositoriesContributedTo?: { totalCount?: number };
        };
      };
    };
    const cc = json?.data?.user?.contributionsCollection;
    if (!cc) return null;
    return {
      lastYearTotal: cc.contributionCalendar?.totalContributions ?? 0,
      commits: cc.totalCommitContributions ?? 0,
      pullRequests: cc.totalPullRequestContributions ?? 0,
      reviews: cc.totalPullRequestReviewContributions ?? 0,
      reposContributedTo: json?.data?.user?.repositoriesContributedTo?.totalCount ?? 0,
    };
  } catch {
    return null;
  }
}

// Resolve the GitHub account that belongs to the subject. Priority:
//   1. The confirmed username on the signup (pixelparents stores it) — trusted.
//   2. A github.com/<login> URL found in the page text — trusted (surfaced link).
//   3. Name-derived candidates — require display-name corroboration (nameOverlaps).
async function resolveUser(ctx: EnricherContext): Promise<GhUser | null> {
  if (ctx.githubUsername) {
    const u = await ghUser(ctx.githubUsername);
    if (u?.login) return u;
  }
  const fromUrl = handleFromUrls(ctx.knownUrls.github, /github\.com\/([A-Za-z0-9-]+)/i);
  if (fromUrl && !/^(orgs|topics|search|trending|about)$/i.test(fromUrl)) {
    const u = await ghUser(fromUrl);
    if (u?.login) return u;
  }
  for (const cand of deriveHandleCandidates(ctx)) {
    const u = await ghUser(cand);
    if (u?.login && nameOverlaps(ctx.fullName, u.name)) return u;
  }
  return null;
}

export async function enrichWithGithub(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const user = await resolveUser(ctx);
    if (!user) return noData("github", "No confirmed GitHub account found");

    const facts: string[] = [];
    const citations: string[] = [`https://github.com/${user.login}`];

    facts.push(`GitHub user @${user.login}${user.name ? ` (${user.name})` : ""}.`);
    if (user.bio) facts.push(`Bio: "${user.bio.replace(/\s+/g, " ").slice(0, 200)}".`);
    if (user.company) facts.push(`Company on GitHub: ${user.company}.`);
    if (user.location) facts.push(`Location: ${user.location}.`);
    if (typeof user.public_repos === "number") facts.push(`${user.public_repos} public repos.`);
    if (typeof user.followers === "number") facts.push(`${user.followers} followers.`);
    if (user.created_at) {
      const years = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (365 * 86400 * 1000),
      );
      facts.push(`Account active ~${years} years (created ${user.created_at.slice(0, 10)}).`);
    }

    const repos =
      (await fetchJson<GhRepo[]>(
        `${GH_API}/users/${encodeURIComponent(user.login)}/repos?sort=stars&per_page=10`,
        { headers: ghHeaders() },
      )) ?? [];
    const ownRepos = repos.filter((r) => !r.fork).slice(0, 5);
    const totalStars = ownRepos.reduce((s, r) => s + (r.stargazers_count ?? 0), 0);
    if (ownRepos.length > 0) {
      facts.push(`Top ${ownRepos.length} non-fork repos by stars (${totalStars}★ total):`);
      for (const r of ownRepos) {
        const star = r.stargazers_count ?? 0;
        facts.push(
          `  • ${r.name} (${star}★)${r.language ? ` [${r.language}]` : ""}${r.description ? ` — ${r.description.slice(0, 120)}` : ""}`,
        );
        citations.push(r.html_url);
      }
    }

    const contrib = await fetchContributions(user.login);
    if (contrib && contrib.lastYearTotal > 0) {
      facts.push(
        `Contributions (trailing 12mo): ${contrib.lastYearTotal} total — ${contrib.commits} commits, ${contrib.pullRequests} PRs, ${contrib.reviews} reviews; active in ${contrib.reposContributedTo} external repos.`,
      );
    }

    return ok("github", facts, citations, {
      user: {
        login: user.login,
        name: user.name,
        company: user.company,
        public_repos: user.public_repos,
        followers: user.followers,
      },
      top_repos: ownRepos.map((r) => ({ name: r.name, stars: r.stargazers_count })),
      contributions: contrib,
      authenticated: Boolean(token()),
    });
  } catch (e) {
    return errored("github", `github lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
