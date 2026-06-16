import { currentUser } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db";
import { signups, children, type ChildRow } from "@/lib/db/schema/signups";
import { isAdminEmail, isEnvAdmin, dbAdminEmails } from "@/lib/admin";
import { ParentsTable, type ParentRow } from "./parents-table";

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
  const [rows, kids, adminSet] = await Promise.all([
    db.select().from(signups).orderBy(desc(signups.createdAt)),
    db.select().from(children),
    dbAdminEmails(),
  ]);

  const kidsBySignup = new Map<string, ChildRow[]>();
  for (const k of kids) {
    const arr = kidsBySignup.get(k.signupId);
    if (arr) arr.push(k);
    else kidsBySignup.set(k.signupId, [k]);
  }

  const data: ParentRow[] = rows.map((r) => ({
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
    photoCount: r.photos?.length ?? 0,
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
  }));

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
        <ParentsTable rows={data} />
      )}
    </div>
  );
}
