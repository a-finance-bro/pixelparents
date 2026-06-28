import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import Markdown from "./markdown";
import InterestTiles from "../signup/interest-tiles";
import { PixelMascot } from "@/components/pixel-mascot";
import { getInterestPool } from "@/lib/interests";

export const metadata = {
  title: "Builder Guidelines — Pixel Parents",
  description:
    "How Pixel Parents tech builders work together: a high-trust, open-source, learn-by-shipping community of OHS parents building software for our kids — protecting PII and using AI safely.",
};

// Live interest pool drives the jigsaw strip.
export const dynamic = "force-dynamic";

// builders.md lives at the repo root so it's easy to find and edit in the open
// source repo. Read at build time and rendered as the page below.
const source = readFileSync(join(process.cwd(), "builders.md"), "utf8");

export default async function BuildersPage() {
  let interests: string[] = [];
  try {
    interests = await getInterestPool();
  } catch {
    interests = [];
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-black px-6 py-16 text-white sm:py-24">
      <InterestTiles interests={interests} variant="strip" />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="flex flex-col items-center gap-6 text-center">
          <PixelMascot widthClass="w-24" href="/" />
        </header>

        <article className="flex flex-col gap-6">
          <Markdown content={source} />
        </article>

        <div className="border-t border-white/10" />

        <footer className="flex flex-col items-center gap-3 text-center text-sm text-white/50">
          <p>
            These guidelines live in{" "}
            <code className="font-mono text-xs text-white/70">builders.md</code>{" "}
            in our{" "}
            <a
              href="https://github.com/drodio/pixelparents"
              className="text-inherit underline decoration-dotted decoration-amber-400 underline-offset-2 transition-colors hover:decoration-amber-300"
            >
              open source
            </a>{" "}
            repo — propose changes there.
          </p>
          <Link
            href="/developers"
            className="text-inherit underline decoration-dotted decoration-amber-400 underline-offset-2 transition-colors hover:decoration-amber-300"
          >
            Explore the Pixel Parents API →
          </Link>
        </footer>
      </div>
    </div>
  );
}
