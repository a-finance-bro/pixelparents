// Kaggle enricher — KEYED (KAGGLE_API_TOKEN, expected "username:key"). Returns
// fast with "no_api_key" when absent. Reports published datasets/notebooks for a
// name/github-derived handle, corroborated by the creator name on returned items.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchJson } from "../http";
import { deriveHandleCandidates, handleFromUrls, nameOverlaps } from "../identity";

const API = "https://www.kaggle.com/api/v1";

type Dataset = { ref?: string; title?: string; creatorName?: string; totalVotes?: number };

function authHeader(): { authorization: string } | null {
  const tok = process.env.KAGGLE_API_TOKEN; // "username:key"
  if (!tok || !tok.includes(":")) return null;
  return { authorization: `Basic ${Buffer.from(tok).toString("base64")}` };
}

export async function enrichWithKaggle(ctx: EnricherContext): Promise<EnrichmentResult> {
  const auth = authHeader();
  if (!auth) return noApiKey("kaggle");
  try {
    const fromUrl = handleFromUrls(ctx.knownUrls.kaggle, /kaggle\.com\/([A-Za-z0-9_-]+)/i);
    const candidates = [fromUrl, ...deriveHandleCandidates(ctx)].filter(Boolean) as string[];

    for (const handle of candidates) {
      const datasets =
        (await fetchJson<Dataset[]>(
          `${API}/datasets/list?user=${encodeURIComponent(handle)}`,
          { headers: auth },
        )) ?? [];
      if (datasets.length === 0) continue;
      const confident =
        handle === fromUrl || datasets.some((d) => nameOverlaps(ctx.fullName, d.creatorName));
      if (!confident) continue;

      const votes = datasets.reduce((s, d) => s + (d.totalVotes ?? 0), 0);
      const top = [...datasets].sort((a, b) => (b.totalVotes ?? 0) - (a.totalVotes ?? 0))[0];
      const facts = [
        `Kaggle: @${handle} — published ${datasets.length} dataset(s) (data-science / ML practitioner).`,
      ];
      if (votes > 0) facts.push(`${votes} community upvotes across their Kaggle work.`);
      if (top?.title) facts.push(`Top dataset: "${top.title}" (${top.totalVotes ?? 0} upvotes).`);
      const citations = [`https://www.kaggle.com/${handle}`];
      if (top?.ref) citations.push(`https://www.kaggle.com/datasets/${top.ref}`);
      return ok("kaggle", facts, citations, { handle, dataset_count: datasets.length, votes });
    }
    return noData("kaggle", "No corroborated Kaggle account");
  } catch (e) {
    return errored("kaggle", `Kaggle lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
