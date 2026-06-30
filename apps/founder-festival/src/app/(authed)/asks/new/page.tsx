import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { getCurrentViewerContext } from "@/lib/current-viewer";
import { isConnectMode } from "@/lib/config/connect-mode";
import { PostAskForm } from "@/components/asks/PostAskForm";

export const dynamic = "force-dynamic";

// Post-an-ask page. Connect-mode only; requires a claimed profile.
export default async function NewAskPage() {
  if (!isConnectMode()) notFound();

  const viewer = await getCurrentViewerContext();
  if (!viewer.isAuthed) redirect("/");
  // Unclaimed users can't post — send them to their profile/home to claim.
  if (!viewer.ownEvaluationId) redirect(viewer.profileHref ?? "/");

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

      <main className="max-w-2xl mx-auto w-full">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-400 mb-4">
          <Link
            href="/asks"
            className="text-amber-400 hover:text-amber-300 hover:underline underline-offset-4"
          >
            Asks
          </Link>
          <span className="mx-2 text-zinc-600" aria-hidden>
            ›
          </span>
          <span className="text-zinc-200" aria-current="page">
            New
          </span>
        </nav>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-2">
          Post an ask
        </h1>
        <p className="text-sm text-zinc-400 mb-8">
          Tell the community what you&apos;re looking for. We&apos;ll suggest people
          whose expertise fits, and they can offer to help.
        </p>
        <PostAskForm />
      </main>
    </div>
  );
}
