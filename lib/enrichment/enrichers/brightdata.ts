// BrightData LinkedIn enricher — KEYED (BRIGHTDATA_API_KEY). pixelparents has NO
// BrightData key, so this surfaces "API key not set" — the whole point of keeping
// it in the roster is VISIBILITY (the directory shows LinkedIn enrichment is an
// available source that simply isn't wired up here).
//
// When a key IS present it triggers BrightData's LinkedIn-profile collection by
// URL (an async scrape: trigger -> poll -> download). That flow is slow and is
// intentionally NOT run inline in this PR — we return no_data with a note so the
// status roster still shows it as "configured but deferred". (Wiring the async
// collection is follow-up work; see the PR's OUT OF SCOPE.)

import type { EnricherContext, EnrichmentResult } from "../types";
import { noData, noApiKey } from "../types";

export async function enrichWithBrightData(ctx: EnricherContext): Promise<EnrichmentResult> {
  if (!process.env.BRIGHTDATA_API_KEY) return noApiKey("brightdata");
  if (!ctx.subject.linkedinUrl) return noData("brightdata", "No LinkedIn URL supplied");
  // Key present but the async LinkedIn collection is deferred (see header).
  return noData(
    "brightdata",
    "BrightData key set, but the async LinkedIn collection is deferred to a follow-up PR",
  );
}
