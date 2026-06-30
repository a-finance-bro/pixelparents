// YouTube enricher — KEYED (GOOGLE_API_KEY). Returns fast with "no_api_key" when
// absent. Searches for talks/interviews mentioning the subject and reports total
// reach. We require a website-host token to corroborate (avoids same-name noise);
// without one we report no_data.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, noApiKey, errored } from "../types";
import { fetchJson, fmtCount } from "../http";
import { normalizeSiteUrl } from "./website";

const YT = "https://www.googleapis.com/youtube/v3";

type SearchResp = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; description?: string; channelTitle?: string };
  }>;
};
type StatsResp = { items?: Array<{ id?: string; statistics?: { viewCount?: string } }> };

function siteToken(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0];
    return label && label.length >= 4 ? label : null;
  } catch {
    return null;
  }
}

export async function enrichWithYouTube(ctx: EnricherContext): Promise<EnrichmentResult> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return noApiKey("youtube");
  try {
    if (!ctx.fullName) return noData("youtube", "No subject name to search");
    const token = siteToken(normalizeSiteUrl(ctx.subject.websiteUrl));
    if (!token) return noData("youtube", "No corroborating company/site token to disambiguate");

    const search = await fetchJson<SearchResp>(
      `${YT}/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(`${ctx.fullName} ${token}`)}&key=${encodeURIComponent(key)}`,
    );
    const corroborated = (search?.items ?? []).filter((v) => {
      const hay = `${v.snippet?.title ?? ""} ${v.snippet?.description ?? ""} ${v.snippet?.channelTitle ?? ""}`.toLowerCase();
      return hay.includes(token.toLowerCase()) && v.id?.videoId;
    }).slice(0, 10);
    if (corroborated.length === 0) return noData("youtube", "No corroborated YouTube appearances");

    const ids = corroborated.map((v) => v.id!.videoId!).join(",");
    const stats = await fetchJson<StatsResp>(
      `${YT}/videos?part=statistics&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(key)}`,
    );
    const views = (stats?.items ?? []).reduce((s, v) => s + Number(v.statistics?.viewCount ?? 0), 0);
    const top = corroborated[0];

    const facts = [
      `Appears in ${corroborated.length} company-corroborated YouTube video(s) (~${fmtCount(views)} total views). Top: "${top?.snippet?.title ?? "(video)"}".`,
    ];
    return ok("youtube", facts, [`https://www.youtube.com/watch?v=${top?.id?.videoId}`], {
      video_count: corroborated.length,
      total_views: views,
    });
  } catch (e) {
    return errored("youtube", `YouTube lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
