import { canViewProfile, coerceShareVisibility, shareFieldsOrDefault } from "@/lib/share";
import type { SignupRow, ChildRow } from "@/lib/db/schema/signups";

// One card's worth of data for the OHS directory. Every field present here is one
// the parent opted into sharing — phone/email are NEVER included (detail-only on
// /p). Plain/serializable so a server component can hand it to the client.
export type DirectoryCard = {
  token: string;
  name: string;
  firstName: string;
  location: string | null;
  // Children the parent chose to share (name/grade/interests). Empty when the
  // "children" field wasn't shared.
  children: { firstName: string; grade: string | null; interests: string[] }[];
  // Deduped parent + child interests the parent chose to share — drives the
  // chips and the interest filter. Empty when neither field was shared.
  interests: string[];
  heroUrl: string | null;
  thumbUrls: string[];
};

// Inclusion gate for the OHS directory. The visibility decision routes through
// the SAME unit-tested canViewProfile the /p page uses (single source of truth),
// so the directory can't silently diverge if the gate's semantics change. The
// sharing preconditions (enabled, has a token, non-blank name to drop auto-save
// drafts) wrap that decision.
export function isDirectoryVisible(row: SignupRow): boolean {
  return (
    row.shareEnabled === true &&
    Boolean(row.shareToken) &&
    Boolean(row.firstName?.trim()) &&
    canViewProfile(coerceShareVisibility(row.shareVisibility), {
      isOwner: false,
      isOhsFamily: true,
    })
  );
}

// The ordered photo pathnames for a card (family photos first, then each shared
// child's), gated behind the "photos" field. The first is the hero; the rest are
// thumbnails. Returns [] when photos weren't shared.
export function directoryPhotoPaths(
  row: SignupRow,
  familyKids: ChildRow[],
): string[] {
  const fields = new Set(shareFieldsOrDefault(row.shareFields));
  if (!fields.has("photos")) return [];
  return [
    ...(row.photos ?? []).map((p) => p.pathname),
    ...familyKids.flatMap((k) => (k.photos ?? []).map((p) => p.pathname)),
  ];
}

// Project a signup + its family's children into a card, exposing ONLY the fields
// the parent opted into via shareFieldsOrDefault. Pure: callers presign photos
// and pass the pathname→url map in. Assumes isDirectoryVisible(row) is true
// (so shareToken is set).
export function buildDirectoryCard(
  row: SignupRow,
  familyKids: ChildRow[],
  urlByPath: Map<string, string>,
  maxThumbs: number,
): DirectoryCard {
  const fields = new Set(shareFieldsOrDefault(row.shareFields));

  const location = fields.has("location")
    ? [row.city, row.state].filter(Boolean).join(", ") || null
    : null;

  const parentInterests = fields.has("interests") ? row.parentInterests ?? [] : [];

  const sharedChildren = fields.has("children")
    ? familyKids.map((k) => ({
        firstName: k.firstName,
        grade: k.grade ?? null,
        interests: k.interests ?? [],
      }))
    : [];

  // Combined interest set for chips + filtering: parent + child interests, but
  // only those whose source field was shared. Deduped case-insensitively,
  // keeping the first-seen display label.
  const childInterests = fields.has("children")
    ? familyKids.flatMap((k) => k.interests ?? [])
    : [];
  const interestByKey = new Map<string, string>();
  for (const i of [...parentInterests, ...childInterests]) {
    const t = i?.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (!interestByKey.has(key)) interestByKey.set(key, t);
  }

  const photoUrls = directoryPhotoPaths(row, familyKids)
    .map((path) => urlByPath.get(path))
    .filter((u): u is string => Boolean(u));

  return {
    token: row.shareToken!,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    firstName: row.firstName,
    location,
    children: sharedChildren,
    interests: Array.from(interestByKey.values()),
    heroUrl: photoUrls[0] ?? null,
    thumbUrls: photoUrls.slice(1, 1 + maxThumbs),
  };
}
