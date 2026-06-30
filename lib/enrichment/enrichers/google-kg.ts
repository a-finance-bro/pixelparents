// Google Knowledge Graph enricher — KEYED (GOOGLE_API_KEY). Returns fast with
// "no_api_key" when the key is absent. A KG knowledge panel is a notability
// threshold. Requires both first and last name to appear in the entity name plus
// a topical-corroboration check to avoid same-named celebrities.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchJson } from "../http";
import { firstLast } from "../identity";

const KG = "https://kgsearch.googleapis.com/v1/entities:search";
const BIZ_TECH = /(founder|ceo|chief executive|entrepreneur|investor|venture|technologist|engineer|computer scientist|programmer|executive|businessperson)/i;

type KgResp = {
  itemListElement?: Array<{
    result?: {
      name?: string;
      "@type"?: string[];
      description?: string;
      detailedDescription?: { articleBody?: string };
    };
  }>;
};

function bothNames(entityName: string, fl: { first: string; last: string }): boolean {
  const n = entityName.toLowerCase();
  return n.includes(fl.first.toLowerCase()) && n.includes(fl.last.toLowerCase());
}

export async function enrichWithGoogleKg(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return noApiKey("google-kg");
  try {
    const fl = firstLast(ctx.fullName);
    if (!fl) return noData("google-kg", "No usable first+last name to search");

    const resp = await fetchJson<KgResp>(
      `${KG}?query=${encodeURIComponent(ctx.fullName!)}&limit=3&types=Person&key=${encodeURIComponent(key)}`,
    );
    const lowerText = ctx.pageText.toLowerCase();
    for (const el of resp?.itemListElement ?? []) {
      const r = el.result;
      if (!r?.name || !(r["@type"] ?? []).includes("Person")) continue;
      if (!bothNames(r.name, fl)) continue;
      const desc = `${r.description ?? ""} ${r.detailedDescription?.articleBody ?? ""}`;
      const corroborated =
        BIZ_TECH.test(desc) ||
        desc
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .some((t) => t.length >= 4 && lowerText.includes(t));
      if (!corroborated) continue;

      const facts = [
        `Google Knowledge Graph entity exists for "${r.name}"${r.description ? ` — ${r.description}` : ""}. A notability threshold that's hard to manufacture.`,
      ];
      if (r.detailedDescription?.articleBody) {
        facts.push(`Knowledge Graph detail: "${r.detailedDescription.articleBody.slice(0, 300)}".`);
      }
      return ok("google-kg", facts, [`https://www.google.com/search?q=${encodeURIComponent(ctx.fullName!)}`], {
        name: r.name,
        description: r.description,
      });
    }
    return noData("google-kg", "No corroborated Knowledge Graph person entity");
  } catch (e) {
    return errored("google-kg", `Knowledge Graph lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
