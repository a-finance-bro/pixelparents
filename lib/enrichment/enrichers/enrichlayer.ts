// EnrichLayer enricher — KEYED (ENRICHLAYER_API_KEY). EnrichLayer (formerly
// Proxycurl) returns structured LinkedIn profile data by URL. pixelparents has no
// key, so this surfaces "API key not set". When a key IS present it fetches the
// profile and reports headline / current role / education / location.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchJson } from "../http";

const PROFILE = "https://enrichlayer.com/api/v2/profile";

type Profile = {
  full_name?: string;
  headline?: string;
  occupation?: string;
  city?: string;
  country_full_name?: string;
  experiences?: Array<{ title?: string; company?: string }>;
  education?: Array<{ school?: string; degree_name?: string }>;
};

export async function enrichWithEnrichLayer(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.ENRICHLAYER_API_KEY;
  if (!key) return noApiKey("enrichlayer");
  try {
    if (!ctx.subject.linkedinUrl) return noData("enrichlayer", "No LinkedIn URL supplied");
    const profile = await fetchJson<Profile>(
      `${PROFILE}?linkedin_profile_url=${encodeURIComponent(ctx.subject.linkedinUrl)}`,
      { headers: { authorization: `Bearer ${key}` } },
    );
    if (!profile?.full_name && !profile?.headline) {
      return noData("enrichlayer", "EnrichLayer returned no profile data");
    }
    const facts: string[] = [];
    if (profile.full_name) facts.push(`LinkedIn name: ${profile.full_name}.`);
    if (profile.headline) facts.push(`Headline: "${profile.headline}".`);
    if (profile.occupation) facts.push(`Current role: ${profile.occupation}.`);
    const loc = [profile.city, profile.country_full_name].filter(Boolean).join(", ");
    if (loc) facts.push(`Location: ${loc}.`);
    const edu = (profile.education ?? []).map((e) => e.school).filter(Boolean).slice(0, 3);
    if (edu.length) facts.push(`Education: ${edu.join(", ")}.`);

    return ok("enrichlayer", facts, ctx.subject.linkedinUrl ? [ctx.subject.linkedinUrl] : [], {
      full_name: profile.full_name,
      headline: profile.headline,
    });
  } catch (e) {
    return errored("enrichlayer", `EnrichLayer lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
