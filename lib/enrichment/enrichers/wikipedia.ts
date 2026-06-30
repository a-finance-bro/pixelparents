// Wikipedia enricher — KEYLESS. Looks the subject up by name via the MediaWiki
// REST search + summary endpoints. A Wikipedia article is a strong notability
// signal. Precision: we only accept a page whose title plausibly matches the
// subject's name and that isn't a disambiguation page.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { nameOverlaps, handleFromUrls } from "../identity";

const REST = "https://en.wikipedia.org/w/rest.php/v1";
const SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

type SearchResp = { pages?: Array<{ key: string; title: string; description?: string | null }> };
type Summary = {
  title?: string;
  description?: string;
  extract?: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
};

async function summaryFor(titleOrKey: string): Promise<Summary | null> {
  return fetchJson<Summary>(`${SUMMARY}/${encodeURIComponent(titleOrKey)}`);
}

export async function enrichWithWikipedia(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    // Prefer a direct wikipedia.org/wiki/<title> URL if we have one.
    const fromUrl = handleFromUrls(ctx.knownUrls.wikipedia, /wikipedia\.org\/wiki\/([^?#]+)/i);
    let summary: Summary | null = null;
    if (fromUrl) summary = await summaryFor(decodeURIComponent(fromUrl));

    if (!summary && ctx.fullName) {
      const search = await fetchJson<SearchResp>(
        `${REST}/search/page?q=${encodeURIComponent(ctx.fullName)}&limit=5`,
      );
      for (const p of search?.pages ?? []) {
        if (!nameOverlaps(ctx.fullName, p.title)) continue;
        const s = await summaryFor(p.key);
        if (s && s.type !== "disambiguation") {
          summary = s;
          break;
        }
      }
    }

    if (!summary || !summary.title) return noData("wikipedia", "No matching Wikipedia article");
    if (summary.type === "disambiguation")
      return noData("wikipedia", "Only a disambiguation page matched");

    const page = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;
    const facts: string[] = [`Has an English Wikipedia article: "${summary.title}".`];
    if (summary.description) facts.push(`Wikipedia short description: ${summary.description}.`);
    if (summary.extract) facts.push(`Summary: ${summary.extract.slice(0, 400)}`);

    return ok("wikipedia", facts, [page], {
      title: summary.title,
      description: summary.description,
    });
  } catch (e) {
    return errored("wikipedia", `wikipedia lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
