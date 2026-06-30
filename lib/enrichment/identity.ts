// Identity helpers — re-implemented cleanly from the donor's identity.ts /
// extract.ts. Used by enrichers to derive candidate handles from a name and to
// corroborate that an account belongs to the subject (precision over recall: a
// wrong attribution is worse than a missing signal).

import type { EnricherContext, KnownUrls } from "./types";

// Empty bucketed-URL map.
export function emptyKnownUrls(): KnownUrls {
  return {
    github: [],
    wikipedia: [],
    wikidata: [],
    yc: [],
    hackernews: [],
    stackoverflow: [],
    npm: [],
    huggingface: [],
    kaggle: [],
    producthunt: [],
    twitter: [],
  };
}

// Pull recognizable platform URLs out of free text, bucketed by platform. Mirrors
// the donor's extractKnownUrls so enrichers can short-circuit ("we already know
// the GitHub URL").
export function extractKnownUrls(text: string): KnownUrls {
  const out = emptyKnownUrls();
  if (!text) return out;
  const matches = text.match(/https?:\/\/[^\s)\]"'<>]+/gi) ?? [];
  for (const u of matches) {
    const lower = u.toLowerCase();
    if (lower.includes("github.com")) out.github.push(u);
    else if (lower.includes("wikipedia.org")) out.wikipedia.push(u);
    else if (lower.includes("wikidata.org")) out.wikidata.push(u);
    else if (lower.includes("news.ycombinator.com")) out.hackernews.push(u);
    else if (lower.includes("ycombinator.com")) out.yc.push(u);
    else if (lower.includes("stackoverflow.com") || lower.includes("stackexchange.com"))
      out.stackoverflow.push(u);
    else if (lower.includes("npmjs.com")) out.npm.push(u);
    else if (lower.includes("huggingface.co")) out.huggingface.push(u);
    else if (lower.includes("kaggle.com")) out.kaggle.push(u);
    else if (lower.includes("producthunt.com")) out.producthunt.push(u);
    else if (lower.includes("twitter.com") || lower.includes("x.com")) out.twitter.push(u);
  }
  for (const key of Object.keys(out) as Array<keyof KnownUrls>) {
    out[key] = [...new Set(out[key])];
  }
  return out;
}

// First capture of `re` across a list of URLs (e.g. extract a handle from a URL).
export function handleFromUrls(urls: string[], re: RegExp): string | null {
  for (const u of urls) {
    const m = u.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

// Candidate handles derived from a full name: "Jane Doe" -> ["jane-doe",
// "janedoe", "jane", ...]. Used by enrichers that must GUESS a username; results
// must always be corroborated (nameOverlaps) before they're trusted.
export function deriveHandleCandidates(ctx: EnricherContext): string[] {
  const handles = new Set<string>();
  const known = ctx.githubUsername?.trim();
  if (known) handles.add(known.toLowerCase());
  const name = (ctx.fullName ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const last = parts[parts.length - 1]!;
    handles.add(parts.join("-"));
    handles.add(parts.join(""));
    handles.add(first + last);
    handles.add(first + "." + last);
    handles.add(first[0]! + last);
  } else if (parts.length === 1) {
    handles.add(parts[0]!);
  }
  return [...handles].filter(Boolean).slice(0, 6);
}

// Does a candidate display name overlap the subject's name strongly enough to
// trust the attribution? Two-token names need both tokens; single-token need it.
export function nameOverlaps(
  fullName: string | null | undefined,
  candidate: string | null | undefined,
): boolean {
  const a = (fullName ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const b = new Set((candidate ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  if (a.length === 0 || b.size === 0) return false;
  const overlap = a.filter((t) => b.has(t)).length;
  return a.length >= 2 ? overlap >= 2 : overlap >= 1;
}

// Split a full name into {first, last}; null when it doesn't parse into two parts.
export function firstLast(fullName: string | null | undefined): { first: string; last: string } | null {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { first: parts[0]!, last: parts[parts.length - 1]! };
}
