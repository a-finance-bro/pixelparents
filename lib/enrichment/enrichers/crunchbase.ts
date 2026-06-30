// Crunchbase (via BrightData) enricher — KEYED (BRIGHTDATA_API_KEY). pixelparents
// has no key, so this surfaces "API key not set". Kept in the roster for
// visibility: authoritative company data (funding, exits, employees) is an
// available source that isn't wired up here.
//
// The authoritative Crunchbase data is collected via BrightData's async dataset
// (trigger -> poll -> download), which is deferred to a follow-up PR — so even
// with a key we report no_data with an explanatory note.

import type { EnricherContext, EnrichmentResult } from "../types";
import { noData, noApiKey } from "../types";

export async function enrichWithCrunchbase(_ctx: EnricherContext): Promise<EnrichmentResult> {
  void _ctx;
  if (!process.env.BRIGHTDATA_API_KEY) return noApiKey("crunchbase");
  return noData(
    "crunchbase",
    "BrightData key set, but the async Crunchbase dataset is deferred to a follow-up PR",
  );
}
