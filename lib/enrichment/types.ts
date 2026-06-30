// Shared types for the (de-scored) enrichment engine.
//
// Ported from apps/founder-festival/src/lib/enrichers/types.ts but rebuilt for
// pixelparents with TWO firm design changes:
//   1. NO numeric scoring anywhere. An enricher contributes INFORMATION (facts +
//      citations), never points. Downstream we extract an info profile, not a score.
//   2. EVERY enricher reports a STATUS — including "API key not set" — so the full
//      roster of sources is always visible (we keep results even when they yield
//      no facts, instead of silently dropping them like the donor did).
//
// This package shares NOTHING with the founder-festival app: no shared DB, no
// shared API, no cross-app imports. The code was re-implemented cleanly here and
// persists onto the existing pixelparents `signups.extra` jsonb.

// Every enrichment source, keyed by a stable string.
export type EnrichmentSource =
  // Keyless / free sources (run for real with no API key).
  | "github"
  | "wikipedia"
  | "wikidata"
  | "yc"
  | "hackernews"
  | "hn-tokenmaxxing"
  | "npm"
  | "huggingface"
  | "crates"
  | "tranco"
  | "openalex"
  | "devto"
  | "stackoverflow"
  | "sec-edgar"
  | "producthunt"
  | "kaggle"
  | "nfx"
  | "neo"
  | "librariesio"
  | "patents"
  | "website"
  // Keyed sources (return fast with "no_api_key" when the key is absent).
  | "google-kg"
  | "youtube"
  | "brightdata"
  | "crunchbase"
  | "enrichlayer"
  | "exa-domain"
  | "twitter";

// Outcome of running a single enricher. We KEEP every result so the full status
// roster is visible — including sources that produced no facts or have no key.
//   ok          — ran and produced at least one fact.
//   no_api_key  — a keyed source whose env key is not set (ran nothing, fast).
//   no_data     — ran for real but found nothing about this subject.
//   error       — threw / timed out / non-OK HTTP.
export type EnrichmentStatus = "ok" | "no_api_key" | "no_data" | "error";

// Shared shape across all enrichment sources. Each enricher contributes a labeled
// list of human-readable facts plus citation URLs and an optional raw payload for
// inspection. NO points, NO score — information only.
export type EnrichmentResult = {
  source: EnrichmentSource;
  status: EnrichmentStatus;
  // Short human-readable note explaining the status (e.g. "API key not set",
  // "No matching account found"). Always present for non-ok statuses.
  note?: string;
  // Human-readable bullets describing what we learned about the subject.
  facts: string[];
  // Citation URLs supporting those facts.
  citations: string[];
  // Raw payload for debugging; kept verbatim for inspection.
  raw?: unknown;
};

// The subject we are enriching. All fields optional — an enricher uses whatever
// it needs and reports "no_data" when it has nothing to work with. This is the
// public entry shape (pixelparents directory profile), distinct from the richer
// internal EnricherContext the registry threads to each enricher.
export type EnrichmentSubject = {
  name?: string | null;
  // Personal / company homepage to scrape (keyless website enricher).
  websiteUrl?: string | null;
  // LinkedIn profile URL (used by keyed BrightData/EnrichLayer enrichers).
  linkedinUrl?: string | null;
  // Known GitHub username (pixelparents stores this on the signup directly, so we
  // don't have to guess it from the name like the donor did).
  githubUsername?: string | null;
};

// Context threaded to every enricher's run(). Built once per subject by the
// registry from the EnrichmentSubject. `pageText` + `extraUrls` let enrichers
// scan for handles/usernames the way the donor scanned Exa highlights.
export type EnricherContext = {
  subject: EnrichmentSubject;
  // Best-effort full name (the subject name, trimmed).
  fullName: string | null;
  // GitHub login if known.
  githubUsername: string | null;
  // Free-text we've gathered about the subject (e.g. scraped website text). Other
  // enrichers may scan this for usernames / auxiliary URLs.
  pageText: string;
  // Any auxiliary URLs we've discovered (e.g. socials scraped off the website),
  // bucketed by platform — mirrors the donor's extractKnownUrls output.
  knownUrls: KnownUrls;
};

// URLs bucketed by platform, discovered from the subject's website / inputs.
export type KnownUrls = {
  github: string[];
  wikipedia: string[];
  wikidata: string[];
  yc: string[];
  hackernews: string[];
  stackoverflow: string[];
  npm: string[];
  huggingface: string[];
  kaggle: string[];
  producthunt: string[];
  twitter: string[];
};

// A single enricher in the registry. To add/remove a source, add/remove ONE
// entry — the run loop and aggregation are source-agnostic.
export interface Enricher {
  source: EnrichmentSource;
  run: (ctx: EnricherContext) => Promise<EnrichmentResult>;
  // Optional per-source deadline override (ms).
  timeoutMs?: number;
}

// Helpers to build results with a consistent shape.
export function ok(
  source: EnrichmentSource,
  facts: string[],
  citations: string[],
  raw?: unknown,
): EnrichmentResult {
  return { source, status: "ok", facts, citations, raw };
}
export function noData(source: EnrichmentSource, note = "No matching data found"): EnrichmentResult {
  return { source, status: "no_data", note, facts: [], citations: [] };
}
export function noApiKey(source: EnrichmentSource, note = "API key not set"): EnrichmentResult {
  return { source, status: "no_api_key", note, facts: [], citations: [] };
}
export function errored(source: EnrichmentSource, note: string): EnrichmentResult {
  return { source, status: "error", note, facts: [], citations: [] };
}
