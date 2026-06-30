import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { getCurrentViewerContext } from "@/lib/current-viewer";
import { isConnectMode } from "@/lib/config/connect-mode";
import { listOpenAsks } from "@/lib/asks";
import { AsksBoardFilter } from "@/components/asks/AsksBoardFilter";
import { INDUSTRY_LABELS, INDUSTRY_SLUGS } from "@/lib/industries";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Asks board — lists open asks (newest first), filterable by expertise tag.
// Connect-mode only; 404 on festival.so.
export default async function AsksBoardPage({ searchParams }: PageProps) {
  if (!isConnectMode()) notFound();

  const sp = await searchParams;
  const validSlugs = new Set<string>(INDUSTRY_SLUGS as readonly string[]);
  const industryRaw = typeof sp.industry === "string" ? sp.industry : "";
  const industries = industryRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => validSlugs.has(s));

  const [viewer, asks] = await Promise.all([
    getCurrentViewerContext(),
    listOpenAsks(industries),
  ]);

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

      <main className="max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Asks
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Ask the community for help — and get matched to people whose
              expertise fits.
            </p>
          </div>
          {viewer.isAuthed && (
            <Link
              href="/asks/new"
              className="shrink-0 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Post an ask
            </Link>
          )}
        </div>

        <section className="mt-6 mb-8">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
            Filter by expertise
          </p>
          <AsksBoardFilter active={industries} />
        </section>

        {asks.length === 0 ? (
          <p className="text-sm text-zinc-500 py-12 text-center">
            {industries.length > 0
              ? "No open asks match these tags yet."
              : "No open asks yet. Be the first to post one."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {asks.map((a) => (
              <li key={a.id}>
                <a
                  href={`/asks/${a.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold text-zinc-100">
                      {a.title}
                    </h2>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {a.offerCount} {a.offerCount === 1 ? "offer" : "offers"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400 line-clamp-2 whitespace-pre-line">
                    {a.body}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.expertiseTags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300"
                      >
                        {INDUSTRY_LABELS[t as keyof typeof INDUSTRY_LABELS] ?? t}
                      </span>
                    ))}
                    {a.authorName && (
                      <span className="text-xs text-zinc-500">
                        · asked by {a.authorName}
                      </span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
