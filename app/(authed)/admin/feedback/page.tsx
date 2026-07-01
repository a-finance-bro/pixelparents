import { currentUser } from "@clerk/nextjs/server";
import { isAdminEmail } from "@/lib/admin";
import { hasDatabase } from "@/lib/db";
import { listFeedback } from "@/lib/db/feedback";
import { updateFeedbackStatus } from "./actions";

export const dynamic = "force-dynamic";

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) : "—";
}

// Coarsen an author identifier to a short, non-PII handle for display. We store
// signup id + Clerk id (no email/name), so the worst case is a short opaque token.
function coarseSubmitter(signupId: string | null, clerkId: string | null): string {
  const src = signupId ?? clerkId;
  if (!src) return "Anonymous";
  return `#${src.replace(/^user_/, "").slice(0, 8)}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "resolved"
      ? "border-emerald-500/40 text-emerald-300"
      : status === "reviewed"
        ? "border-sky-500/40 text-sky-300"
        : "border-yellow-500/40 text-yellow-300";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${cls}`}>
      {status}
    </span>
  );
}

export default async function FeedbackAdminPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? undefined;
  if (!(await isAdminEmail(email))) return null;

  if (!hasDatabase()) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Feedback</h2>
        <section className="rounded-lg border border-white/10 p-6 text-sm text-white/50">
          <code>DATABASE_URL</code> isn&apos;t configured.
        </section>
      </div>
    );
  }

  const feedback = await listFeedback();
  const openCount = feedback.filter((f) => f.status === "new").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Feedback</h2>
        {openCount > 0 && (
          <span className="rounded-full border border-yellow-500/40 px-2 py-0.5 text-xs font-semibold text-yellow-300">
            {openCount} new
          </span>
        )}
      </div>
      <p className="text-sm text-white/50">
        In-app feedback from the sidebar &ldquo;Send feedback&rdquo; widget, newest first.
      </p>

      {feedback.length === 0 ? (
        <section className="rounded-lg border border-white/10 p-6 text-sm text-white/50">
          No feedback yet.
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {feedback.map((f) => (
            <section
              key={f.id}
              className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-white/70">
                  {coarseSubmitter(f.authorSignupId, f.authorClerkId)}
                </span>
                <span className="ml-auto">
                  <StatusBadge status={f.status} />
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm text-white/70">{f.message}</p>

              <p className="text-xs text-white/40">
                Submitted {fmt(f.createdAt)}
                {f.pagePath ? ` · from ${f.pagePath}` : ""}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {f.status !== "reviewed" && (
                  <form action={updateFeedbackStatus}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="status" value="reviewed" />
                    <button
                      type="submit"
                      className="rounded-full border border-sky-500/40 px-4 py-1.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/10"
                    >
                      Mark reviewed
                    </button>
                  </form>
                )}
                {f.status !== "resolved" && (
                  <form action={updateFeedbackStatus}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <button
                      type="submit"
                      className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                      Mark resolved
                    </button>
                  </form>
                )}
                {f.status !== "new" && (
                  <form action={updateFeedbackStatus}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="status" value="new" />
                    <button
                      type="submit"
                      className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Reopen
                    </button>
                  </form>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
