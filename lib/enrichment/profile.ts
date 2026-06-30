// PURE helpers tying the (de-scored) enrichment engine to the pixelparents
// signup `extra` jsonb. NO DB, NO network here — safe to import from server
// components, the directory-card builder, and unit tests. The persisted bytes
// all live under `signups.extra` (no new columns — schema-drift is a known P0
// risk in this project; see lib/builder.ts), keyed:
//
//   extra.websiteUrl        string  — the member's personal-website URL (NEW field;
//                                      mirrors linkedinUrl/githubUsername).
//   extra.enrichmentOptIn   bool    — the member opted in to auto-building their
//                                      profile from public data. DEFAULT OFF.
//   extra.enrichment        FullEnrichment | { ...; ownerEdit?; status? }
//                                    — the stored enrichment payload + owner edits.
//
// Privacy: enrichment is OPT-IN (default off), runs only on public user-provided
// sources, and the raw fact dump + source-status roster are OWNER-ONLY. Only a
// curated info profile (bio / expertise / how-they-can-help) is ever eligible to
// appear on a shared card, and only behind the default-OFF "profile_enrichment"
// share field, routed through the SAME visibility/verification gates as the rest
// of the directory (see lib/directory.ts, lib/share.ts).

import type { FullEnrichment } from "./subject";
import type { InfoProfile } from "./info-extract";

// Build/refresh lifecycle of a stored enrichment, surfaced as a status indicator.
//   building — a run was kicked off and hasn't persisted a result yet.
//   ready    — a result is persisted.
//   error    — the last run failed (kept so the owner can retry).
export type EnrichmentBuildStatus = "building" | "ready" | "error";

// Owner-authored overrides of the AI-generated curated profile. Stored ALONGSIDE
// the AI output so a refresh never clobbers a manual edit (we merge, preferring
// the owner's text). Each field is optional — only set ones override.
export type EnrichmentOwnerEdit = {
  bio?: string;
  expertiseTags?: string[];
  canHelpWith?: string[];
  // When the owner has touched ANY field — drives the "edited by you" affordance
  // and is the flag a refresh checks before merging.
  editedByOwner?: boolean;
  editedAt?: string;
};

// What we persist under extra.enrichment. Extends the engine's FullEnrichment
// with the build status + the owner's edits (kept separate from the AI output so
// the two never clobber each other).
export type StoredEnrichment = FullEnrichment & {
  buildStatus?: EnrichmentBuildStatus;
  // ISO timestamp of when the last run was kicked off (idempotency / rate limit).
  startedAt?: string;
  ownerEdit?: EnrichmentOwnerEdit;
};

// Read the personal-website URL off a signup's extra (trimmed, or null).
export function websiteUrlOf(extra: Record<string, unknown> | null | undefined): string | null {
  const raw = (extra ?? {}).websiteUrl;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t : null;
}

// Read the opt-in flag (default OFF — only an explicit `true` opts in).
export function enrichmentOptInOf(extra: Record<string, unknown> | null | undefined): boolean {
  return (extra ?? {}).enrichmentOptIn === true;
}

// Normalize a user-supplied website URL to a safe absolute http(s) URL, or null.
// Adds an https:// scheme when the user typed a bare host. Rejects anything that
// isn't http/https (no javascript:, data:, mailto:, etc.) so it can be rendered
// as a link without sanitization elsewhere. Length-capped.
export function normalizeWebsiteUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().slice(0, 300);
  if (!s) return null;
  // If the input carries an explicit scheme (e.g. "mailto:", "javascript:",
  // "http://"), only http/https may pass — reject everything else outright so we
  // never prepend https:// onto a dangerous scheme. A bare host (no scheme) gets
  // an https:// prefix.
  // A scheme is "<word>:" NOT immediately followed by digits (that would be a
  // host:port, e.g. "example.com:8080", which is a bare host, not a scheme).
  const schemeMatch = /^([a-z][a-z0-9+.-]*):(?!\d)/i.exec(s);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (scheme !== "http" && scheme !== "https") return null;
  } else {
    s = `https://${s}`;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // Require a dotted hostname (reject bare "localhost"-style or scheme-only junk).
  if (!u.hostname.includes(".")) return null;
  return u.toString();
}

// The curated, shareable slice of an enrichment — bio + expertise + how-they-can-
// help, with any owner edits merged in (owner text wins). This is the ONLY part
// of an enrichment that may ever appear on a shared card / another member's
// profile. The raw `factsBySource` dump and the `statuses` roster are OWNER-ONLY
// and intentionally excluded here. Returns null when there's nothing to show.
export type CuratedEnrichment = {
  bio: string;
  expertiseTags: string[];
  canHelpWith: string[];
  editedByOwner: boolean;
};

// Merge the AI info profile with the owner's edits (owner wins per-field).
export function mergeOwnerEdit(info: InfoProfile, edit?: EnrichmentOwnerEdit): CuratedEnrichment {
  const e = edit ?? {};
  return {
    bio: typeof e.bio === "string" && e.bio.trim() ? e.bio.trim() : info.bio,
    expertiseTags:
      Array.isArray(e.expertiseTags) && e.expertiseTags.length > 0
        ? e.expertiseTags
        : info.expertiseTags,
    canHelpWith:
      Array.isArray(e.canHelpWith) && e.canHelpWith.length > 0 ? e.canHelpWith : info.canHelpWith,
    editedByOwner: e.editedByOwner === true,
  };
}

// Project a stored enrichment into its curated, shareable slice — or null when
// there is nothing worth showing (no bio, no tags, no help bullets). Callers that
// gate on the "profile_enrichment" share field use THIS to render a card; they
// never touch factsBySource / statuses.
export function curatedEnrichmentOf(stored: StoredEnrichment | null | undefined): CuratedEnrichment | null {
  if (!stored?.info) return null;
  const merged = mergeOwnerEdit(stored.info, stored.ownerEdit);
  const empty = !merged.bio.trim() && merged.expertiseTags.length === 0 && merged.canHelpWith.length === 0;
  return empty ? null : merged;
}

// Re-apply the owner's edits onto a freshly-run enrichment so a refresh never
// clobbers manual work. The fresh AI output replaces `info`/`factsBySource`/
// `statuses`; the owner's `ownerEdit` block is carried forward verbatim.
export function preserveOwnerEdit(
  fresh: FullEnrichment,
  previous: StoredEnrichment | null | undefined,
): StoredEnrichment {
  const ownerEdit = previous?.ownerEdit;
  return {
    ...fresh,
    buildStatus: "ready",
    ...(ownerEdit && ownerEdit.editedByOwner ? { ownerEdit } : {}),
  };
}
