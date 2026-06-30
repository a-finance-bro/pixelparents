// Exa high-signal-domain enricher — KEYED (EXA_API_KEY). pixelparents has no key,
// so this surfaces "API key not set". When a key IS present it runs an Exa search
// restricted to high-signal press/startup domains to surface third-party mentions
// of the subject.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchWithTimeout, USER_AGENT } from "../http";

const SEARCH = "https://api.exa.ai/search";
const HIGH_SIGNAL_DOMAINS = [
  "crunchbase.com",
  "techcrunch.com",
  "forbes.com",
  "businessinsider.com",
  "ycombinator.com",
  "bloomberg.com",
  "venturebeat.com",
  "fortune.com",
];

type ExaResp = {
  results?: Array<{ url?: string; title?: string; highlights?: string[] }>;
};

export async function enrichWithExaDomain(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.EXA_API_KEY;
  if (!key) return noApiKey("exa-domain");
  try {
    if (!ctx.fullName) return noData("exa-domain", "No subject name to search");
    const res = await fetchWithTimeout(SEARCH, {
      method: "POST",
      headers: { "user-agent": USER_AGENT, "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        query: `${ctx.fullName} founder investor startup`,
        type: "auto",
        numResults: 6,
        includeDomains: HIGH_SIGNAL_DOMAINS,
        contents: { highlights: true },
      }),
    });
    if (!res || !res.ok) return errored("exa-domain", `Exa HTTP ${res?.status ?? "error"}`);
    const data = (await res.json()) as ExaResp;
    const results = (data.results ?? []).filter((r) => r.url);
    if (results.length === 0) return noData("exa-domain", "No high-signal mentions found");

    const facts = [`High-signal sources mentioning ${ctx.fullName}:`];
    const citations: string[] = [];
    for (const r of results.slice(0, 6)) {
      let host = "";
      try {
        host = new URL(r.url!).hostname.replace(/^www\./, "");
      } catch {
        /* ignore */
      }
      facts.push(`  • [${host}] ${r.title ?? r.url}`);
      if (r.highlights?.[0]) facts.push(`    "${r.highlights[0].slice(0, 200)}"`);
      citations.push(r.url!);
    }
    return ok("exa-domain", facts, citations, { result_count: results.length });
  } catch (e) {
    return errored("exa-domain", `Exa lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
