// Hugging Face enricher — KEYLESS (optional HUGGING_FACE_TOKEN raises the rate
// limit). Resolves a HF handle from a surfaced huggingface.co/<user> URL or a
// name-derived candidate (corroborated by the profile's display name), then
// reports model/dataset counts and total downloads.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson, fmtCount } from "../http";
import { deriveHandleCandidates, handleFromUrls, nameOverlaps } from "../identity";

const HF_API = "https://huggingface.co/api";
const RESERVED = new Set(["models", "datasets", "spaces", "docs", "blog", "tasks", "papers"]);

function authHeader(): Record<string, string> {
  const t = process.env.HUGGING_FACE_TOKEN;
  return t ? { authorization: `Bearer ${t}` } : {};
}

type Overview = { fullname?: string; user?: string };
type Model = { id?: string; downloads?: number; likes?: number };

export async function enrichWithHuggingFace(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    let handle: string | null = null;
    let confirmedVia: "url" | "name-match" | null = null;
    let overview: Overview | null = null;

    const fromUrl = handleFromUrls(ctx.knownUrls.huggingface, /huggingface\.co\/([A-Za-z0-9_-]+)/i);
    if (fromUrl && !RESERVED.has(fromUrl.toLowerCase())) {
      overview = await fetchJson<Overview>(`${HF_API}/users/${encodeURIComponent(fromUrl)}/overview`, {
        headers: authHeader(),
      });
      if (overview) {
        handle = fromUrl;
        confirmedVia = "url";
      }
    }
    if (!confirmedVia) {
      for (const cand of deriveHandleCandidates(ctx)) {
        const o = await fetchJson<Overview>(`${HF_API}/users/${encodeURIComponent(cand)}/overview`, {
          headers: authHeader(),
        });
        if (o && nameOverlaps(ctx.fullName, o.fullname)) {
          handle = cand;
          overview = o;
          confirmedVia = "name-match";
          break;
        }
      }
    }
    if (!handle || !confirmedVia) return noData("huggingface", "No corroborated Hugging Face account");

    const models =
      (await fetchJson<Model[]>(
        `${HF_API}/models?author=${encodeURIComponent(handle)}&limit=50&sort=downloads&direction=-1`,
        { headers: authHeader() },
      )) ?? [];
    const datasets =
      (await fetchJson<Array<{ id?: string }>>(
        `${HF_API}/datasets?author=${encodeURIComponent(handle)}&limit=50`,
        { headers: authHeader() },
      )) ?? [];
    // A bare handle with zero published artifacts is a weak/empty match — don't
    // claim the person is "on Hugging Face" with nothing to show. (A name-derived
    // handle like "linus-torvalds" can resolve to an empty placeholder account.)
    if (models.length === 0 && datasets.length === 0) {
      return noData("huggingface", "Account exists but has no published models or datasets");
    }
    const totalDl = models.reduce((s, m) => s + (m.downloads ?? 0), 0);
    const totalLikes = models.reduce((s, m) => s + (m.likes ?? 0), 0);
    const top = models[0];

    const facts = [
      `Hugging Face: @${handle}${overview?.fullname ? ` (${overview.fullname})` : ""} — ${models.length} model(s), ${datasets.length} dataset(s).`,
    ];
    if (totalDl > 0) facts.push(`${fmtCount(totalDl)} total model downloads, ${totalLikes} likes.`);
    if (top?.id) facts.push(`Top model: ${top.id} (${fmtCount(top.downloads ?? 0)} downloads, ${top.likes ?? 0} likes).`);

    const citations = [`https://huggingface.co/${handle}`];
    if (top?.id) citations.push(`https://huggingface.co/${top.id}`);
    return ok("huggingface", facts, citations, {
      handle,
      confirmed_via: confirmedVia,
      model_count: models.length,
      dataset_count: datasets.length,
      total_downloads: totalDl,
    });
  } catch (e) {
    return errored("huggingface", `Hugging Face lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
