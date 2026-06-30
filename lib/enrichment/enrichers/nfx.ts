// NFX Signal investor enricher — KEYED (NFX_SIGNAL_TOKEN — a Signal JWT). Returns
// fast with "no_api_key" when absent. Searches the Signal GraphQL API by name and
// reports investor profile facts (stages, sectors, check size). Investor-focus
// signal.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchWithTimeout, USER_AGENT } from "../http";
import { nameOverlaps } from "../identity";

const GQL = "https://signal-api.nfx.com/graphql";

type NfxPerson = {
  name?: string;
  slug?: string;
  firm?: string;
  headline?: string;
  stages?: string[];
  verticals?: string[];
};

export async function enrichWithNfx(ctx: EnricherContext): Promise<EnrichmentResult> {
  const token = process.env.NFX_SIGNAL_TOKEN;
  if (!token) return noApiKey("nfx");
  try {
    if (!ctx.fullName) return noData("nfx", "No subject name to search");
    const query = `query InvestorsAutocomplete($q:String!){ investorsAutocomplete(nameOrFirm:$q, first:5){ name slug firm headline stages verticals } }`;
    const res = await fetchWithTimeout(GQL, {
      method: "POST",
      headers: {
        "user-agent": USER_AGENT,
        authorization: `Bearer ${token}`,
        origin: "https://signal.nfx.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables: { q: ctx.fullName } }),
    });
    if (!res || !res.ok) return errored("nfx", `NFX HTTP ${res?.status ?? "error"}`);
    const data = (await res.json()) as { data?: { investorsAutocomplete?: NfxPerson[] } };
    const person = (data?.data?.investorsAutocomplete ?? []).find((p) => nameOverlaps(ctx.fullName, p.name));
    if (!person?.slug) return noData("nfx", "Not listed on NFX Signal");

    const facts = [`Listed on NFX Signal as ${person.name}${person.firm ? ` (${person.firm})` : ""}.`];
    if (person.headline) facts.push(`Headline: "${person.headline}".`);
    if (person.stages?.length) facts.push(`Invests at stages: ${person.stages.join(", ")}.`);
    if (person.verticals?.length) facts.push(`Sectors: ${person.verticals.join(", ")}.`);

    return ok("nfx", facts, [`https://signal.nfx.com/investors/${person.slug}`], {
      slug: person.slug,
      firm: person.firm,
    });
  } catch (e) {
    return errored("nfx", `NFX lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
