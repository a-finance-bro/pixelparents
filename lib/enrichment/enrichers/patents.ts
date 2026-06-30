// USPTO patents enricher — KEYED (USPTO_API_KEY for the PatentsView search API).
// Returns fast with "no_api_key" when absent. Reports patents naming the subject
// as an inventor, corroborated by an assignee token appearing in the subject's
// page text (avoids same-name false positives).

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchWithTimeout, USER_AGENT } from "../http";
import { firstLast } from "../identity";

const SEARCH = "https://search.patentsview.org/api/v1/patent/";

type PvPatent = {
  patent_id?: string;
  patent_title?: string;
  inventors?: Array<{ inventor_name_first?: string; inventor_name_last?: string }>;
  assignees?: Array<{ assignee_organization?: string }>;
};
type PvResp = { patents?: PvPatent[] };

const GENERIC = new Set(["inc", "llc", "ltd", "corp", "the", "and", "company", "group", "co"]);

export async function enrichWithPatents(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.USPTO_API_KEY;
  if (!key) return noApiKey("patents");
  try {
    const fl = firstLast(ctx.fullName);
    if (!fl) return noData("patents", "No usable first+last name to search");

    const q = JSON.stringify({
      _and: [
        { inventors: { inventor_name_last: fl.last } },
        { inventors: { inventor_name_first: fl.first } },
      ],
    });
    const fields = JSON.stringify(["patent_id", "patent_title", "inventors.inventor_name_first", "inventors.inventor_name_last", "assignees.assignee_organization"]);
    const res = await fetchWithTimeout(
      `${SEARCH}?q=${encodeURIComponent(q)}&f=${encodeURIComponent(fields)}&o=${encodeURIComponent('{"size":25}')}`,
      { headers: { "user-agent": USER_AGENT, "x-api-key": key } },
    );
    if (!res || !res.ok) return errored("patents", `USPTO HTTP ${res?.status ?? "error"}`);
    const data = (await res.json()) as PvResp;
    const lowerText = ctx.pageText.toLowerCase();

    const matching = (data.patents ?? []).filter((p) => {
      const assigneeTokens = (p.assignees ?? [])
        .flatMap((a) => (a.assignee_organization ?? "").toLowerCase().split(/[^a-z0-9]+/))
        .filter((t) => t.length >= 4 && !GENERIC.has(t));
      return assigneeTokens.some((t) => lowerText.includes(t));
    });
    if (matching.length === 0) return noData("patents", "No corroborated patents");

    const assignee = matching[0]!.assignees?.[0]?.assignee_organization ?? "an organization";
    const facts = [
      `Named inventor on ${matching.length} corroborated US patent(s), assigned to ${assignee} — e.g. "${matching[0]!.patent_title}". A deep technical / invention signal.`,
    ];
    return ok("patents", facts, ["https://ppubs.uspto.gov/pubwebapp/"], {
      patent_count: matching.length,
      sample_title: matching[0]!.patent_title,
    });
  } catch (e) {
    return errored("patents", `USPTO lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
