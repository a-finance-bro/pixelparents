import { currentUser } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db";
import { signups, children, type ChildRow } from "@/lib/db/schema/signups";
import { isAdminEmail, isEnvAdmin, dbAdminEmails } from "@/lib/admin";
import { signedPhotoUrls } from "@/lib/blob";
import { listPhotoTags } from "@/lib/db/photo-tags";
import { ParentsTable, type ParentRow } from "./parents-table";
import { type Person, type PhotoTag } from "./photo-gallery";

export const dynamic = "force-dynamic";

export default async function ParentsPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? undefined;
  if (!(await isAdminEmail(email))) return null;

  if (!hasDatabase()) {
    return (
      <section className="rounded-lg border border-white/10 p-6 text-sm">
        <code>DATABASE_URL</code> isn&rsquo;t configured yet.
      </section>
    );
  }

  const db = getDb();
  const [rows, kids, adminSet, allTags] = await Promise.all([
    db.select().from(signups).orderBy(desc(signups.createdAt)),
    db.select().from(children),
    dbAdminEmails(),
    listPhotoTags(),
  ]);

  const kidsBySignup = new Map<string, ChildRow[]>();
  for (const k of kids) {
    const arr = kidsBySignup.get(k.signupId);
    if (arr) arr.push(k);
    else kidsBySignup.set(k.signupId, [k]);
  }

  // Photo tags grouped by photo pathname.
  const tagsByPath = new Map<string, PhotoTag[]>();
  for (const t of allTags) {
    const arr = tagsByPath.get(t.photoPathname) ?? [];
    arr.push({
      id: t.id,
      taggedType: t.taggedType as "parent" | "child",
      taggedId: t.taggedId,
      taggedName: t.taggedName,
    });
    tagsByPath.set(t.photoPathname, arr);
  }

  // Everyone taggable in a photo: all parents + all children (with parent context).
  const signupById = new Map(rows.map((r) => [r.id, r]));
  const people: Person[] = [
    ...rows.map((r) => ({
      type: "parent" as const,
      id: r.id,
      label: `${r.firstName} ${r.lastName}`,
    })),
    ...kids.map((k) => {
      const parent = signupById.get(k.signupId);
      return {
        type: "child" as const,
        id: k.id,
        label: parent ? `${k.firstName} (${parent.lastName})` : k.firstName,
      };
    }),
  ];

  // Presign every family's private photos in one batch, then map back by pathname.
  const allPathnames = rows.flatMap((r) => (r.photos ?? []).map((p) => p.pathname));
  const signed = await signedPhotoUrls(allPathnames);
  const urlByPath = new Map<string, string>();
  allPathnames.forEach((p, i) => {
    if (signed[i]) urlByPath.set(p, signed[i]);
  });

  const data: ParentRow[] = rows.map((r) => {
    const photos = (r.photos ?? [])
      .map((p) => ({
        url: urlByPath.get(p.pathname) ?? "",
        pathname: p.pathname,
        width: p.width,
        height: p.height,
        tags: tagsByPath.get(p.pathname) ?? [],
      }))
      .filter((p) => p.url);
    return {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      githubUsername: r.githubUsername,
      ohsAffiliation: r.ohsAffiliation,
      technicalDepth: r.technicalDepth,
      timeCommitment: r.timeCommitment,
      skillsets: r.skillsets,
      city: r.city,
      state: r.state,
      parentInterests: r.parentInterests,
      photoCount: photos.length,
      photos,
      dbAdmin: adminSet.has(r.email.toLowerCase()),
      envAdmin: isEnvAdmin(r.email),
      kids: (kidsBySignup.get(r.id) ?? []).map((k) => ({
        id: k.id,
        firstName: k.firstName,
        grade: k.grade,
      })),
      submittedLabel: new Date(r.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      createdAtMs: new Date(r.createdAt).getTime(),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Parents</h2>
      <p className="text-sm text-white/60">
        {rows.length} submission{rows.length === 1 ? "" : "s"} · {kids.length}{" "}
        child{kids.length === 1 ? "" : "ren"}
      </p>
      {rows.length === 0 ? (
        <section className="rounded-lg border border-white/10 p-6 text-sm">
          No submissions yet.
        </section>
      ) : (
        <ParentsTable rows={data} people={people} />
      )}
    </div>
  );
}
