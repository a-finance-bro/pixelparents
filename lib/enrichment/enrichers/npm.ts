// npm enricher — KEYLESS. Re-implemented from the donor's npm.ts. Finds the
// subject's published packages via the registry search API, keyed off either a
// confirmed npmjs.com/~<handle> URL or a name-derived handle (corroborated by the
// top package's author name). Precision over recall: a derived handle is dropped
// unless the author name overlaps the subject.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson, fmtCount } from "../http";
import { deriveHandleCandidates, handleFromUrls, nameOverlaps } from "../identity";

const SEARCH = "https://registry.npmjs.org/-/v1/search";
const REGISTRY = "https://registry.npmjs.org";

type SearchObj = {
  package: { name: string; description?: string; links?: { npm?: string } };
  downloads?: { monthly?: number };
};
type SearchResp = { objects: SearchObj[]; total: number };
type Manifest = { author?: { name?: string } | null };

async function searchByHandle(handle: string): Promise<SearchResp | null> {
  return fetchJson<SearchResp>(
    `${SEARCH}?text=maintainer:${encodeURIComponent(handle)}&size=20`,
  );
}

export async function enrichWithNpm(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    let handle = handleFromUrls(ctx.knownUrls.npm, /npmjs\.com\/~([A-Za-z0-9._-]+)/i);
    let resp: SearchResp | null = null;
    let confirmedVia: "url" | "author-name" | null = null;

    if (handle) {
      resp = await searchByHandle(handle);
      if (resp && resp.total > 0) confirmedVia = "url";
      else handle = null;
    }

    if (!confirmedVia) {
      for (const cand of deriveHandleCandidates(ctx)) {
        const r = await searchByHandle(cand);
        if (!r || r.total === 0) continue;
        const topPkg = r.objects[0]?.package.name;
        if (!topPkg) continue;
        const manifest = await fetchJson<Manifest>(
          `${REGISTRY}/${encodeURIComponent(topPkg)}/latest`,
        );
        if (!nameOverlaps(ctx.fullName, manifest?.author?.name)) continue;
        handle = cand;
        resp = r;
        confirmedVia = "author-name";
        break;
      }
    }

    if (!handle || !resp || !confirmedVia) {
      return noData("npm", "No corroborated npm maintainer account found");
    }

    const top = resp.objects
      .map((o) => ({
        name: o.package.name,
        monthly: o.downloads?.monthly ?? 0,
        url: o.package.links?.npm ?? `https://www.npmjs.com/package/${o.package.name}`,
      }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5);
    const totalMonthly = top.reduce((s, p) => s + p.monthly, 0);

    const facts: string[] = [
      `npm: @${handle} maintains ${resp.total.toLocaleString("en-US")} package${resp.total === 1 ? "" : "s"}.`,
    ];
    if (totalMonthly > 0) {
      facts.push(
        `~${fmtCount(totalMonthly)} monthly downloads across top packages. Top: ${top[0]!.name} (${fmtCount(top[0]!.monthly)}/mo).`,
      );
    }
    if (top.length > 1) {
      facts.push(
        `Other packages: ${top.slice(1, 4).map((p) => `${p.name} (${fmtCount(p.monthly)}/mo)`).join(", ")}.`,
      );
    }

    const citations = [`https://www.npmjs.com/~${handle}`, ...(top[0] ? [top[0].url] : [])];
    return ok("npm", facts, citations, {
      handle,
      confirmed_via: confirmedVia,
      package_count: resp.total,
      top_packages: top.map((p) => ({ name: p.name, monthly_downloads: p.monthly })),
    });
  } catch (e) {
    return errored("npm", `npm lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
