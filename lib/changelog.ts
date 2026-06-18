import { desc } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db";
import { changelogEntries, changelogSubscribers } from "@/lib/db/schema/changelog";
import { sql } from "drizzle-orm";

export type ChangeType = "feature" | "enhancement" | "bug_fix";

export const CHANGE_TYPES: { value: ChangeType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "bug_fix", label: "Bug Fix" },
];

// Tailwind badge styling per change type (pixelparents black/amber theme).
export const CHANGE_TYPE_STYLE: Record<ChangeType, string> = {
  feature: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
  enhancement: "bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-400/30",
  bug_fix: "bg-rose-400/10 text-rose-300 ring-1 ring-inset ring-rose-400/30",
};

export function changeTypeLabel(t: string): string {
  return CHANGE_TYPES.find((c) => c.value === t)?.label ?? t;
}

export const CHANGELOG_CATEGORIES: { slug: string; label: string }[] = [
  { slug: "signup", label: "Signup" },
  { slug: "profiles", label: "Profiles" },
  { slug: "sharing", label: "Sharing" },
  { slug: "photos", label: "Photos" },
  { slug: "admin", label: "Admin" },
  { slug: "developers", label: "Developer API" },
  { slug: "email", label: "Email" },
  { slug: "security", label: "Security" },
  { slug: "performance", label: "Performance" },
  { slug: "infrastructure", label: "Infrastructure" },
  { slug: "design", label: "Design" },
];

export function categoryLabel(slug: string): string {
  return CHANGELOG_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export type ChangelogEntryView = {
  id: string;
  slug: string;
  shippedAt: string; // ISO
  title: string;
  summary: string;
  bullets: string[];
  changeType: ChangeType;
  categories: string[];
};

// Newest-first list of all entries for the public page.
export async function getChangelogEntries(): Promise<ChangelogEntryView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getDb()
      .select()
      .from(changelogEntries)
      .orderBy(desc(changelogEntries.shippedAt));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      shippedAt: r.shippedAt.toISOString(),
      title: r.title,
      summary: r.summary,
      bullets: r.bullets ?? [],
      changeType: (r.changeType as ChangeType) ?? "enhancement",
      categories: r.categories ?? [],
    }));
  } catch (err) {
    console.error("getChangelogEntries failed:", err);
    return [];
  }
}

// Subscribe an email (idempotent). Re-subscribing clears a prior unsubscribe.
export async function subscribeEmail(email: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const clean = email.trim().toLowerCase();
  try {
    await getDb()
      .insert(changelogSubscribers)
      .values({ email: clean })
      .onConflictDoUpdate({
        target: changelogSubscribers.email,
        set: { unsubscribedAt: sql`null` },
      });
    return true;
  } catch (err) {
    console.error("subscribeEmail failed:", err);
    return false;
  }
}
