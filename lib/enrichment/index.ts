// Enrichment registry + orchestrator. Runs EVERY enricher in parallel (each
// bounded by a per-enricher timeout) and KEEPS every result — including
// no_api_key / no_data / error — so the full status roster is always visible.
// NO scoring anywhere: we aggregate information, not points.

import type {
  Enricher,
  EnricherContext,
  EnrichmentResult,
  EnrichmentSource,
  EnrichmentStatus,
  EnrichmentSubject,
} from "./types";
import { errored } from "./types";
import { extractKnownUrls } from "./identity";

import { enrichWithWebsite } from "./enrichers/website";
import { enrichWithGithub } from "./enrichers/github";
import { enrichWithWikipedia } from "./enrichers/wikipedia";
import { enrichWithWikidata } from "./enrichers/wikidata";
import { enrichWithYC } from "./enrichers/yc";
import { enrichWithHackerNews } from "./enrichers/hackernews";
import { enrichWithHnTokenmaxxing } from "./enrichers/hn-tokenmaxxing";
import { enrichWithNpm } from "./enrichers/npm";
import { enrichWithHuggingFace } from "./enrichers/huggingface";
import { enrichWithCrates } from "./enrichers/crates";
import { enrichWithTranco } from "./enrichers/tranco";
import { enrichWithOpenAlex } from "./enrichers/openalex";
import { enrichWithDevto } from "./enrichers/devto";
import { enrichWithStackOverflow } from "./enrichers/stackoverflow";
import { enrichWithSecEdgar } from "./enrichers/sec-edgar";
import { enrichWithNeo } from "./enrichers/neo";
import { enrichWithGoogleKg } from "./enrichers/google-kg";
import { enrichWithYouTube } from "./enrichers/youtube";
import { enrichWithLibrariesIo } from "./enrichers/librariesio";
import { enrichWithKaggle } from "./enrichers/kaggle";
import { enrichWithProductHunt } from "./enrichers/producthunt";
import { enrichWithNfx } from "./enrichers/nfx";
import { enrichWithPatents } from "./enrichers/patents";
import { enrichWithBrightData } from "./enrichers/brightdata";
import { enrichWithCrunchbase } from "./enrichers/crunchbase";
import { enrichWithTwitter } from "./enrichers/twitter";
import { enrichWithEnrichLayer } from "./enrichers/enrichlayer";
import { enrichWithExaDomain } from "./enrichers/exa-domain";

export type { EnrichmentResult, EnrichmentSubject } from "./types";

// Per-enricher deadline. Promise.allSettled waits for the slowest member, so each
// enricher is capped — a hung external API can't stall the whole run. Tune via env.
const ENRICHER_TIMEOUT_MS = Number(process.env.ENRICHMENT_TIMEOUT_MS) || 15_000;

// THE REGISTRY. To add/remove a source, add/remove ONE entry. Keyless sources run
// for real; keyed sources with no env key return fast with status "no_api_key".
export const ENRICHERS: Enricher[] = [
  { source: "website", run: enrichWithWebsite },
  { source: "github", run: enrichWithGithub },
  { source: "wikipedia", run: enrichWithWikipedia },
  { source: "wikidata", run: enrichWithWikidata },
  { source: "yc", run: enrichWithYC },
  { source: "hackernews", run: enrichWithHackerNews },
  { source: "hn-tokenmaxxing", run: enrichWithHnTokenmaxxing },
  { source: "npm", run: enrichWithNpm },
  { source: "huggingface", run: enrichWithHuggingFace },
  { source: "crates", run: enrichWithCrates },
  { source: "tranco", run: enrichWithTranco },
  { source: "openalex", run: enrichWithOpenAlex },
  { source: "devto", run: enrichWithDevto },
  { source: "stackoverflow", run: enrichWithStackOverflow },
  { source: "sec-edgar", run: enrichWithSecEdgar },
  { source: "neo", run: enrichWithNeo },
  { source: "producthunt", run: enrichWithProductHunt },
  { source: "kaggle", run: enrichWithKaggle },
  { source: "librariesio", run: enrichWithLibrariesIo },
  { source: "google-kg", run: enrichWithGoogleKg },
  { source: "youtube", run: enrichWithYouTube },
  { source: "nfx", run: enrichWithNfx },
  { source: "patents", run: enrichWithPatents },
  { source: "brightdata", run: enrichWithBrightData },
  { source: "crunchbase", run: enrichWithCrunchbase },
  { source: "twitter", run: enrichWithTwitter },
  { source: "enrichlayer", run: enrichWithEnrichLayer },
  { source: "exa-domain", run: enrichWithExaDomain },
];

// Cap a single enricher: on deadline or rejection resolve to an "error" result so
// the orchestrator KEEPS it in the roster (visible) rather than dropping it.
export function withTimeout(
  source: EnrichmentSource,
  p: Promise<EnrichmentResult>,
  ms: number = ENRICHER_TIMEOUT_MS,
): Promise<EnrichmentResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(errored(source, `Timed out after ${ms}ms`)), ms);
    p.then(
      (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      (e) => {
        clearTimeout(timer);
        resolve(errored(source, (e as Error)?.message ?? "threw"));
      },
    );
  });
}

// Build the per-subject context threaded to every enricher.
export function buildContext(subject: EnrichmentSubject): EnricherContext {
  const fullName = subject.name?.trim() || null;
  const githubUsername = subject.githubUsername?.trim() || null;
  // pageText seeds the URL extraction; the website enricher contributes more text
  // at run time, but we only have inputs here. Include any provided URLs so other
  // enrichers can pick up handles from them.
  const seedText = [subject.websiteUrl, subject.linkedinUrl, subject.githubUsername]
    .filter(Boolean)
    .join("\n");
  return {
    subject,
    fullName,
    githubUsername,
    pageText: seedText,
    knownUrls: extractKnownUrls(seedText),
  };
}

// One row in the visible status roster.
export type StatusRow = {
  source: EnrichmentSource;
  status: EnrichmentStatus;
  note?: string;
  factCount: number;
};

export type EnrichmentRun = {
  // Facts grouped by source (only sources that produced facts).
  factsBySource: Array<{ source: EnrichmentSource; facts: string[] }>;
  // EVERY enricher's status — incl. no_api_key — so the full roster is visible.
  statuses: StatusRow[];
  // Flat, de-duplicated citation list across all ok results.
  citations: string[];
  // The full result objects (for storage / inspection).
  results: EnrichmentResult[];
};

// Run a set of enrichers against a context, in parallel, keeping every result.
export async function runRegistry(
  enrichers: Enricher[],
  ctx: EnricherContext,
): Promise<EnrichmentRun> {
  const settled = await Promise.allSettled(
    enrichers.map((e) => withTimeout(e.source, e.run(ctx), e.timeoutMs)),
  );
  const results: EnrichmentResult[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : errored(enrichers[i]!.source, (s.reason as Error)?.message ?? "rejected"),
  );

  const factsBySource = results
    .filter((r) => r.status === "ok" && r.facts.length > 0)
    .map((r) => ({ source: r.source, facts: r.facts }));
  const statuses: StatusRow[] = results.map((r) => ({
    source: r.source,
    status: r.status,
    note: r.note,
    factCount: r.facts.length,
  }));
  const citations = [
    ...new Set(results.filter((r) => r.status === "ok").flatMap((r) => r.citations)),
  ];
  return { factsBySource, statuses, citations, results };
}

// Run the full registry against a subject. The single entry point for callers.
export async function runEnrichment(subject: EnrichmentSubject): Promise<EnrichmentRun> {
  return runRegistry(ENRICHERS, buildContext(subject));
}
