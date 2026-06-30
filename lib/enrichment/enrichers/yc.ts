// Y Combinator enricher — KEYLESS. Matches the subject's website domain or a
// surfaced ycombinator.com/companies/<slug> URL against the public YC company
// list (community dump). A YC affiliation is a strong founder signal.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { handleFromUrls } from "../identity";
import { normalizeSiteUrl } from "./website";

const YC_ALL = "https://yc-oss.github.io/api/companies/all.json";

type YcCompany = {
  name?: string;
  slug?: string;
  batch?: string;
  status?: string;
  one_liner?: string;
  website?: string;
  url?: string;
};

// Module-cache the (large) list for the process lifetime.
let cache: { at: number; companies: YcCompany[] } | null = null;
const TTL_MS = 12 * 60 * 60 * 1000;

async function loadCompanies(): Promise<YcCompany[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.companies;
  const data = (await fetchJson<YcCompany[]>(YC_ALL)) ?? [];
  cache = { at: Date.now(), companies: data };
  return data;
}

function host(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function enrichWithYC(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const companies = await loadCompanies();
    if (companies.length === 0) return noData("yc", "YC company list unavailable");

    const matches: YcCompany[] = [];

    const slug = handleFromUrls(ctx.knownUrls.yc, /ycombinator\.com\/companies\/([a-z0-9-]+)/i);
    if (slug) {
      const c = companies.find((co) => co.slug === slug);
      if (c) matches.push(c);
    }

    const siteHost = host(normalizeSiteUrl(ctx.subject.websiteUrl));
    if (siteHost) {
      for (const co of companies) {
        if (host(co.website) === siteHost && !matches.includes(co)) matches.push(co);
      }
    }

    if (matches.length === 0) return noData("yc", "No matching YC company");

    const facts = [`Matched ${matches.length} company on the official YC list:`];
    const citations: string[] = [];
    for (const c of matches.slice(0, 5)) {
      facts.push(`  • ${c.name} (YC ${c.batch ?? "?"}) — ${c.status ?? "?"}. ${c.one_liner ?? ""}`.trim());
      if (c.url) citations.push(c.url);
    }
    return ok("yc", facts, citations, {
      companies: matches.slice(0, 5).map((c) => ({ name: c.name, batch: c.batch, status: c.status })),
    });
  } catch (e) {
    return errored("yc", `YC lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
