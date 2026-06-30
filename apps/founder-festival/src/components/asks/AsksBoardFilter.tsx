"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { INDUSTRY_SLUGS, INDUSTRY_LABELS } from "@/lib/industries";

// Expertise-tag facet for the asks board. Mirrors the directory's industry
// facet: toggling a tag updates the `industry` query param (comma-separated)
// and re-navigates so the server re-queries with the array-overlap filter.
export function AsksBoardFilter({ active }: { active: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeSet = new Set(active);

  function toggle(slug: string) {
    const next = new Set(activeSet);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    const params = new URLSearchParams(sp.toString());
    if (next.size === 0) params.delete("industry");
    else params.set("industry", Array.from(next).join(","));
    router.push(`/asks${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {INDUSTRY_SLUGS.map((slug) => {
        const on = activeSet.has(slug);
        return (
          <button
            key={slug}
            type="button"
            onClick={() => toggle(slug)}
            aria-pressed={on}
            className={
              on
                ? "rounded-full border border-amber-500 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200"
                : "rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            }
          >
            {INDUSTRY_LABELS[slug]}
          </button>
        );
      })}
    </div>
  );
}
