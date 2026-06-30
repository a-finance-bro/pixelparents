// Tranco enricher — KEYLESS. Looks up the independent Tranco popularity rank of
// the subject's website domain (if supplied). A small magnitude/reach signal.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { normalizeSiteUrl } from "./website";

// Tranco's daily-list API: the latest list id, then the rank of a domain on it.
const TRANCO_API = "https://tranco-list.eu/api/lists/date/latest";

type LatestResp = { list_id?: string };
type RankResp = { ranks?: Array<{ rank?: number; date?: string }> };

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function enrichWithTranco(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const host = hostFromUrl(normalizeSiteUrl(ctx.subject.websiteUrl));
    if (!host) return noData("tranco", "No website domain to rank");

    const latest = await fetchJson<LatestResp>(TRANCO_API);
    if (!latest?.list_id) return noData("tranco", "Could not fetch the Tranco list");

    const rankResp = await fetchJson<RankResp>(
      `https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(host)}`,
    );
    const rank = rankResp?.ranks?.find((r) => typeof r.rank === "number")?.rank;
    if (!rank) return noData("tranco", `${host} is not in the Tranco top-1M`);

    const tier = rank <= 10_000 ? "top-10k" : rank <= 100_000 ? "top-100k" : "top-1M";
    const facts = [
      `Tranco: ${host} is a ${tier} global domain (rank #${rank.toLocaleString("en-US")}) — independent reach corroboration.`,
    ];
    return ok("tranco", facts, [`https://tranco-list.eu/query?domains=${encodeURIComponent(host)}`], {
      domain: host,
      rank,
      tier,
    });
  } catch (e) {
    return errored("tranco", `Tranco lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
