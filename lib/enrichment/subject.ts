// Full enrichment orchestrator: run the registry → extract a de-scored info
// profile → assemble the persisted shape. The single high-level entry point used
// by the proof script and (later) the signup trigger.

import { runEnrichment, type EnrichmentRun } from "./index";
import {
  extractInfoProfile,
  emptyInfoProfile,
  hasModelKey,
  type InfoProfile,
  type ModelCall,
} from "./info-extract";
import type { EnrichmentSubject, EnrichmentSource, EnrichmentStatus } from "./types";

// The assembled, persisted-and-rendered enrichment for a subject. De-scored:
// `info` is informational, `statuses` makes every source visible.
export type FullEnrichment = {
  // When the enrichment ran (ISO).
  enrichedAt: string;
  // The subject inputs used (echoed back for provenance).
  subject: EnrichmentSubject;
  // The de-scored info profile (identity, bio, expertise, how-they-can-help).
  info: InfoProfile;
  // Whether an AI info-extraction actually ran (vs. empty fallback).
  infoExtracted: boolean;
  // Facts grouped by source (ok results only).
  factsBySource: Array<{ source: EnrichmentSource; facts: string[] }>;
  // Full status roster — EVERY enricher, incl. "no_api_key".
  statuses: Array<{ source: EnrichmentSource; status: EnrichmentStatus; note?: string; factCount: number }>;
  // De-duplicated citations across all ok sources.
  citations: string[];
};

export type RunFullEnrichmentOpts = {
  // Injectable model call (tests). Defaults to the real gateway/Anthropic call.
  model?: ModelCall;
  // Injectable registry run (tests). Defaults to runEnrichment(subject).
  run?: EnrichmentRun;
};

export async function runFullEnrichment(
  subject: EnrichmentSubject,
  opts: RunFullEnrichmentOpts = {},
): Promise<FullEnrichment> {
  const run = opts.run ?? (await runEnrichment(subject));

  let info = emptyInfoProfile(subject);
  let infoExtracted = false;
  if (run.factsBySource.length > 0 && (opts.model || hasModelKey())) {
    const extracted = await extractInfoProfile(subject, run, opts.model);
    if (extracted) {
      info = extracted;
      infoExtracted = true;
    }
  }

  return {
    enrichedAt: new Date().toISOString(),
    subject,
    info,
    infoExtracted,
    factsBySource: run.factsBySource,
    statuses: run.statuses,
    citations: run.citations,
  };
}
