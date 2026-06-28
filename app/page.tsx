import Link from "next/link";
import InterestTiles from "./signup/interest-tiles";
import { PixelMascot } from "@/components/pixel-mascot";
import {
  getSignupCount,
  getChildrenCount,
  getInterestsCount,
  getBuilderCounts,
} from "@/lib/db/signups";
import { getInterestPool } from "@/lib/interests";

// Reflect live counts + interests.
export const dynamic = "force-dynamic";

export default async function Home() {
  let count = 0;
  let kidsCount = 0;
  let interestsCount = 0;
  let interests: string[] = [];
  let builders = { technical: 0, curious: 0 };
  try {
    [count, kidsCount, interestsCount, interests, builders] = await Promise.all([
      getSignupCount(),
      getChildrenCount(),
      getInterestsCount(),
      getInterestPool(),
      getBuilderCounts(),
    ]);
  } catch {
    count = 0;
    kidsCount = 0;
    interestsCount = 0;
    interests = [];
    builders = { technical: 0, curious: 0 };
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-black px-6 py-12 text-center">
      <InterestTiles interests={interests} variant="fade" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6">
        <PixelMascot widthClass="w-48 max-w-[80vw] sm:w-64" />
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          <Link
            href="/signup"
            className="text-amber-400 underline decoration-amber-400/60 underline-offset-4 transition-colors hover:text-amber-300"
          >
            Sign up
          </Link>{" "}
          to Join{" "}
          <span className="text-amber-400">{count.toLocaleString()}</span> other
          Pixel Parents
        </h1>
        <h2 className="max-w-prose text-xl font-bold text-white/80 sm:text-2xl">
          and connect with{" "}
          <span className="text-amber-400">{kidsCount.toLocaleString()}</span> OHS
          kids
          <br />
          around{" "}
          <span className="text-amber-400">{interestsCount.toLocaleString()}</span>{" "}
          shared interests,{" "}
          <code className="font-mono text-amber-400">IRL</code>
        </h2>
        <p className="max-w-prose text-base italic text-white/70">
          Psst parents: <code className="font-mono text-amber-400">IRL</code> is
          slang our kids use for{" "}
          <code className="font-mono text-amber-400">In Real Life</code>.
        </p>
        <p className="-mt-4 max-w-prose text-base italic text-white/70">
          We never needed to say &quot;IRL&quot; since our whole childhood was
          &quot;in real life!&quot;
        </p>
      </div>

      <footer className="relative z-10 mt-8 text-center text-sm text-white/50">
        Created with{" "}
        <span aria-label="love" role="img">
          ❤️
        </span>{" "}
        by <span className="text-amber-400">{builders.technical.toLocaleString()}</span>{" "}
        technical parents and{" "}
        <span className="text-amber-400">{builders.curious.toLocaleString()}</span>{" "}
        non-technical parents learning to become builders.{" "}
        <Link
          href="/builders"
          className="text-amber-400 underline decoration-amber-400/60 underline-offset-2 transition-colors hover:text-amber-300"
        >
          Learn more about us
        </Link>
        .
      </footer>
    </main>
  );
}
