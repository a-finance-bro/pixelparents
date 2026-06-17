"use client";

import { useEffect, useState } from "react";
import { addPhotoTagAction, removePhotoTagAction } from "./photo-tag-actions";

export type PhotoTag = {
  id: string;
  taggedType: "parent" | "child";
  taggedId: string;
  taggedName: string;
};
export type Person = { type: "parent" | "child"; id: string; label: string };
export type GalleryPhoto = {
  url: string;
  pathname: string;
  width?: number;
  height?: number;
  tags: PhotoTag[];
};

const personKey = (type: string, id: string) => `${type}:${id}`;

// @-mention combobox: type to filter people; pick to tag. Excludes already-tagged.
function MentionInput({
  people,
  exclude,
  onPick,
}: {
  people: Person[];
  exclude: Set<string>;
  onPick: (p: Person) => void;
}) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const query = q.replace(/^@/, "").trim().toLowerCase();
  const matches = people
    .filter((p) => !exclude.has(personKey(p.type, p.id)))
    .filter((p) => query === "" || p.label.toLowerCase().includes(query))
    .slice(0, 8);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 120)}
        placeholder="Type @ to tag a parent or child…"
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/40"
      />
      {show && matches.length > 0 && (
        <div className="absolute bottom-full z-10 mb-1 max-h-56 w-full overflow-auto rounded-lg border border-white/15 bg-zinc-900 shadow-xl">
          {matches.map((p) => (
            <button
              key={personKey(p.type, p.id)}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
                setQ("");
                setShow(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                  p.type === "child"
                    ? "bg-sky-500/15 text-sky-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {p.type}
              </span>
              <span className="text-white/90">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhotoGallery({
  photos,
  people,
  signupId,
}: {
  photos: GalleryPhoto[];
  people: Person[];
  signupId: string;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const [tagsByPath, setTagsByPath] = useState<Record<string, PhotoTag[]>>(() =>
    Object.fromEntries(photos.map((p) => [p.pathname, p.tags ?? []])),
  );
  const open = idx !== null;
  const n = photos.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % n));
      else if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + n) % n));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, n]);

  if (n === 0) return <span className="text-white/30">No photos.</span>;

  const go = (delta: number) => setIdx((i) => (i === null ? i : (i + delta + n) % n));
  const current = idx !== null ? photos[idx] : null;
  const currentTags = current ? tagsByPath[current.pathname] ?? [] : [];

  async function addTag(p: Person) {
    if (!current) return;
    const pathname = current.pathname;
    if ((tagsByPath[pathname] ?? []).some((t) => t.taggedType === p.type && t.taggedId === p.id))
      return;
    const temp: PhotoTag = {
      id: `temp-${Date.now()}`,
      taggedType: p.type,
      taggedId: p.id,
      taggedName: p.label,
    };
    setTagsByPath((prev) => ({ ...prev, [pathname]: [...(prev[pathname] ?? []), temp] }));
    const res = await addPhotoTagAction({
      signupId,
      photoPathname: pathname,
      taggedType: p.type,
      taggedId: p.id,
      taggedName: p.label,
    });
    setTagsByPath((prev) => {
      const list = (prev[pathname] ?? []).filter((t) => t.id !== temp.id);
      if (res.ok && res.id) list.push({ ...temp, id: res.id });
      return { ...prev, [pathname]: list };
    });
  }

  async function removeTag(t: PhotoTag) {
    if (!current) return;
    const pathname = current.pathname;
    setTagsByPath((prev) => ({
      ...prev,
      [pathname]: (prev[pathname] ?? []).filter((x) => x.id !== t.id),
    }));
    if (!t.id.startsWith("temp-")) await removePhotoTagAction(t.id);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => {
          const tags = tagsByPath[p.pathname] ?? [];
          return (
            <button
              key={p.url || i}
              type="button"
              onClick={() => setIdx(i)}
              className="relative overflow-hidden rounded-md ring-1 ring-white/10 transition hover:ring-white/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-24 w-24 cursor-zoom-in object-cover"
              />
              {tags.length > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/90">
                  👤 {tags.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && current && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90"
          onClick={() => setIdx(null)}
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt=""
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setIdx(null)}
              aria-label="Close"
              className="absolute right-4 top-4 text-3xl leading-none text-white/70 hover:text-white"
            >
              ✕
            </button>
            {n > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  aria-label="Previous"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-4 py-2 text-3xl leading-none text-white/80 hover:bg-black/80 hover:text-white sm:left-6"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  aria-label="Next"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-4 py-2 text-3xl leading-none text-white/80 hover:bg-black/80 hover:text-white sm:right-6"
                >
                  ›
                </button>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white/80">
                  {idx! + 1} / {n}
                </div>
              </>
            )}
          </div>

          {/* Tagging panel */}
          <div
            className="border-t border-white/10 bg-black/80 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-white/40">Tagged:</span>
                {currentTags.length === 0 && (
                  <span className="text-sm text-white/40">No one yet.</span>
                )}
                {currentTags.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-sm text-white/90"
                  >
                    {t.taggedName}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`Remove ${t.taggedName}`}
                      className="text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <MentionInput
                people={people}
                exclude={new Set(currentTags.map((t) => personKey(t.taggedType, t.taggedId)))}
                onPick={addTag}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
