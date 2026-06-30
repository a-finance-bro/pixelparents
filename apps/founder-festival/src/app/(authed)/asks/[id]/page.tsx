import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { getCurrentViewerContext } from "@/lib/current-viewer";
import { isConnectMode } from "@/lib/config/connect-mode";
import { INDUSTRY_LABELS } from "@/lib/industries";
import {
  getAsk,
  listAskResponses,
  getSuggestedHelpers,
  getClaimedUserByClerkId,
  ASK_PROPOSAL_LABELS,
  type ResponseProposal,
} from "@/lib/asks";
import { isHelperType } from "@/lib/member-type";
import { profileUrlFor } from "@/lib/profile-slug";
import { db } from "@/db";
import { evaluations, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { OfferHelpForm } from "@/components/asks/OfferHelpForm";
import { ResponseDecisionButtons } from "@/components/asks/ResponseDecisionButtons";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function tagLabel(slug: string): string {
  return INDUSTRY_LABELS[slug as keyof typeof INDUSTRY_LABELS] ?? slug;
}

export default async function AskDetailPage({ params }: PageProps) {
  if (!isConnectMode()) notFound();

  const { id } = await params;
  const ask = await getAsk(id);
  if (!ask) notFound();

  const viewer = await getCurrentViewerContext();
  const claimed = viewer.clerkUserId
    ? await getClaimedUserByClerkId(viewer.clerkUserId)
    : null;

  const isAuthor = claimed?.evaluationId === ask.authorEvaluationId;
  const viewerIsHelper = !!claimed && !isAuthor && isHelperType(claimed.memberType);

  const [responses, suggested] = await Promise.all([
    listAskResponses(ask.id),
    getSuggestedHelpers(ask, 8),
  ]);

  const viewerAlreadyResponded =
    !!claimed && responses.some((r) => r.responderEvaluationId === claimed.evaluationId);

  // Resolve display names + profile links for suggested helpers (the matcher
  // returns evaluation ids only). One batched query.
  const suggestedIds = suggested.map((s) => s.evaluationId);
  const helperMeta =
    suggestedIds.length > 0
      ? await db
          .select({
            evaluationId: evaluations.id,
            fullName: evaluations.fullName,
            slug: evaluations.slug,
            slugKind: evaluations.slugKind,
            clerkUsername: users.clerkUsername,
          })
          .from(evaluations)
          .leftJoin(users, eq(users.evaluationId, evaluations.id))
          .where(inArray(evaluations.id, suggestedIds))
      : [];
  const metaById = new Map(helperMeta.map((m) => [m.evaluationId, m]));

  return (
    <div className="flex flex-col flex-1 px-4 sm:px-6 pt-3 pb-8 sm:pt-4 sm:pb-12 bg-[#151515] text-zinc-100">
      <header className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8 w-full">
        <Link href="/?home=1" aria-label="Founder Festival home" className="opacity-90 hover:opacity-100 transition-opacity shrink-0">
          <img
            src="/images/founder-festival-logo.png"
            alt="Founder Festival"
            width={498}
            height={444}
            className="w-12 sm:w-14 h-auto"
          />
        </Link>
        <SiteHeaderNav
          currentPage="asks"
          userProfileHref={viewer.profileHref}
          isAuthed={viewer.isAuthed}
        />
      </header>

      <main className="max-w-3xl mx-auto w-full flex flex-col gap-8">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
          <Link
            href="/asks"
            className="text-amber-400 hover:text-amber-300 hover:underline underline-offset-4"
          >
            Asks
          </Link>
          <span className="mx-2 text-zinc-600" aria-hidden>›</span>
          <span className="text-zinc-200" aria-current="page">Ask</span>
        </nav>

        {/* The ask */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {ask.title}
            </h1>
            {ask.status !== "open" && (
              <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-400">
                {ask.status}
              </span>
            )}
          </div>
          {ask.authorName && (
            <p className="text-sm text-zinc-500 mb-4">
              Asked by{" "}
              <a href={ask.authorProfileHref} className="text-zinc-300 hover:underline">
                {ask.authorName}
              </a>
            </p>
          )}
          <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
            {ask.body}
          </p>
          {ask.expertiseTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ask.expertiseTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {tagLabel(t)}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Helper's offer form — only for a logged-in non-author helper who
            hasn't already offered, and only while the ask is open. */}
        {viewerIsHelper && ask.status === "open" && !viewerAlreadyResponded && (
          <OfferHelpForm askId={ask.id} />
        )}
        {viewerIsHelper && viewerAlreadyResponded && (
          <p className="text-sm text-emerald-400">
            You&apos;ve offered to help on this ask.
          </p>
        )}

        {/* Suggested people who can help — shown to the asker (and anyone, for
            discovery). Hidden when there are none. */}
        {suggested.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold mb-1">
              Suggested people who can help
            </h2>
            <p className="text-xs text-zinc-500 mb-3">
              Matched on shared expertise. No scores — just overlap with this ask&apos;s tags.
            </p>
            <ul className="flex flex-col gap-2">
              {suggested.map((s) => {
                const meta = metaById.get(s.evaluationId);
                const href = profileUrlFor({
                  evalId: s.evaluationId,
                  slug: meta?.slug,
                  slugKind: meta?.slugKind,
                  clerkUsername: meta?.clerkUsername,
                });
                return (
                  <li
                    key={s.evaluationId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <a href={href} className="text-sm font-medium text-zinc-100 hover:underline">
                        {meta?.fullName ?? s.fullName ?? "A community member"}
                      </a>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.overlapTags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
                          >
                            {tagLabel(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <a
                      href={href}
                      className="shrink-0 rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
                    >
                      View profile
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Responses. The author can accept/decline; on accept, the helper's
            profile link (intro path) is revealed. */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">
            Offers {responses.length > 0 ? `(${responses.length})` : ""}
          </h2>
          {responses.length === 0 ? (
            <p className="text-sm text-zinc-500">No offers yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {responses.map((r) => {
                const accepted = r.status === "accepted";
                // Reveal the connect path when accepted: the asker (and the
                // helper) see the helper's profile link. Others see the offer
                // text but not a privileged intro.
                const showIntro = accepted && (isAuthor || r.responderClerkUserId === viewer.clerkUserId);
                return (
                  <li
                    key={r.id}
                    className={
                      "rounded-lg border p-4 " +
                      (accepted
                        ? "border-emerald-700/60 bg-emerald-900/10"
                        : r.status === "declined"
                          ? "border-zinc-800 bg-zinc-900/20 opacity-70"
                          : "border-zinc-800 bg-zinc-900/40")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-zinc-100">
                          {r.responderName ?? "A community member"}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500">
                          proposes: {ASK_PROPOSAL_LABELS[r.proposes as ResponseProposal] ?? r.proposes}
                        </span>
                      </div>
                      {r.status === "offered" && isAuthor && (
                        <ResponseDecisionButtons askId={ask.id} responseId={r.id} />
                      )}
                      {accepted && (
                        <span className="shrink-0 text-xs font-medium text-emerald-400">
                          Accepted
                        </span>
                      )}
                      {r.status === "declined" && (
                        <span className="shrink-0 text-xs text-zinc-500">Declined</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-300 whitespace-pre-line">
                      {r.offer}
                    </p>
                    {showIntro && (
                      <div className="mt-3 rounded border border-emerald-800/50 bg-emerald-900/20 p-3 text-sm text-emerald-200">
                        You&apos;re connected.{" "}
                        <a
                          href={r.responderProfileHref}
                          className="font-medium underline underline-offset-2"
                        >
                          View {r.responderName ?? "their"} profile
                        </a>{" "}
                        to reach out. We&apos;ll add an intro email here soon.
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
