// X/Twitter enricher — KEYED (BRIGHTDATA_API_KEY for the BrightData X dataset).
// pixelparents has no key, so this surfaces "API key not set". Kept in the roster
// for visibility: follower reach / verification is an available source not wired
// up here. The async dataset is deferred to a follow-up PR.

import type { EnricherContext, EnrichmentResult } from "../types";
import { noData, noApiKey } from "../types";

export async function enrichWithTwitter(_ctx: EnricherContext): Promise<EnrichmentResult> {
  void _ctx;
  if (!process.env.BRIGHTDATA_API_KEY) return noApiKey("twitter");
  return noData(
    "twitter",
    "BrightData key set, but the async X/Twitter dataset is deferred to a follow-up PR",
  );
}
