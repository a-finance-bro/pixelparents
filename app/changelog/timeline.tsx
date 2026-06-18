"use client";

import { useMemo, useState } from "react";
import {
  CHANGE_TYPES,
  CHANGE_TYPE_STYLE,
  CHANGELOG_CATEGORIES,
  categoryLabel,
  changeTypeLabel,
  type ChangelogEntryView,
  type ChangeType,
} from "@/lib/changelog";

function formatDate(iso: string): string {
  // Explicit UTC so server and client render the same string (no hydration drift).
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ChangelogTimeline({ entries }: { entries: ChangelogEntryView[] }) {
  const [type, setType] = useState<ChangeType | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // Only show category filters that actually appear in the entries.
  const usedCategories = useMemo(() => {
    const set = new Set(entries.flatMap((e) => e.categories));
    return CHANGELOG_CATEGORIES.filter((c) => set.has(c.slug));
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!type || e.changeType === type) &&
          (!category || e.categories.includes(category)),
      ),
    [entries, type, category],
  );

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
        : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/10"
    }`;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-white/35">
            Type
          </span>
          <button type="button" className={pill(type === null)} onClick={() => setType(null)}>
            All
          </button>
          {CHANGE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={pill(type === t.value)}
              onClick={() => setType(type === t.value ? null : t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {usedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-white/35">
              Area
            </span>
            <button
              type="button"
              className={pill(category === null)}
              onClick={() => setCategory(null)}
            >
              All
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={pill(category === c.slug)}
                onClick={() => setCategory(category === c.slug ? null : c.slug)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <ol className="mt-8 border-l-2 border-white/10 pl-6">
        {filtered.map((e) => (
          <li key={e.id} id={e.slug} className="relative pb-10 last:pb-0">
            <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-black bg-amber-400" />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  CHANGE_TYPE_STYLE[e.changeType]
                }`}
              >
                {changeTypeLabel(e.changeType)}
              </span>
              {e.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/55 ring-1 ring-inset ring-white/10"
                >
                  {categoryLabel(c)}
                </span>
              ))}
              <span className="ml-auto text-xs text-white/40">{formatDate(e.shippedAt)}</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">{e.title}</h3>
            <p className="mt-1 text-white/70">{e.summary}</p>
            {e.bullets.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/55">
                {e.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {filtered.length === 0 && (
        <p className="mt-8 text-sm text-white/45">No entries match those filters.</p>
      )}
    </div>
  );
}
