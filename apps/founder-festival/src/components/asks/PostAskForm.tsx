"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_SLUGS, INDUSTRY_LABELS } from "@/lib/industries";
import {
  validateAskTitle,
  validateAskBody,
  ASK_TITLE_MAX,
  ASK_BODY_MAX,
  ASK_MAX_TAGS,
} from "@/lib/ask-validate";

const ERROR_COPY: Record<string, string> = {
  title_empty: "Give your ask a title.",
  title_too_long: `Title is too long (max ${ASK_TITLE_MAX} characters).`,
  body_empty: "Describe what you're looking for.",
  body_too_long: `Description is too long (max ${ASK_BODY_MAX} characters).`,
  tags_invalid: "One of the expertise tags isn't recognized.",
  tags_too_many: `Pick at most ${ASK_MAX_TAGS} expertise tags.`,
  rate_limited: "You've posted a lot recently. Try again later.",
  not_claimed: "Claim your profile before posting an ask.",
};

// Post-an-ask form. Renders on /asks/new. Client-side validates, POSTs to
// /api/asks, then routes to the new ask's detail page.
export function PostAskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleCheck = validateAskTitle(title);
  const bodyCheck = validateAskBody(body);
  const titleErr = !titleCheck.ok && title.trim() ? ERROR_COPY[titleCheck.error] : null;
  const bodyErr = !bodyCheck.ok && body.trim() ? ERROR_COPY[bodyCheck.error] : null;
  const tooManyTags = tags.length > ASK_MAX_TAGS;

  const canSave = titleCheck.ok && bodyCheck.ok && !tooManyTags && !saving;

  function toggleTag(slug: string) {
    setTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  }

  async function onSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/asks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: titleCheck.ok ? titleCheck.value : title,
          body: bodyCheck.ok ? bodyCheck.value : body,
          expertiseTags: tags,
        }),
      });
      const data: { ok?: boolean; id?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok || !data.id) {
        setError(ERROR_COPY[data.error ?? ""] ?? "Couldn't post your ask. Try again.");
        return;
      }
      router.push(`/asks/${data.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="ask-title" className="text-sm font-medium text-zinc-200">
          What are you looking for?
        </label>
        <p className="text-xs text-zinc-500 -mt-1">
          A one-line summary, e.g. &ldquo;I want to talk to a VC who cares about EdTech&rdquo;.
        </p>
        <input
          id="ask-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={ASK_TITLE_MAX + 20}
          placeholder="I want to talk to a VC who cares about EdTech"
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        />
        {titleErr && <p className="text-xs text-red-400">{titleErr}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ask-body" className="text-sm font-medium text-zinc-200">
          More detail
        </label>
        <p className="text-xs text-zinc-500 -mt-1">
          Context helps people decide if they can help — what you&apos;re building,
          what you want to learn, how much time you&apos;re hoping for.
        </p>
        <textarea
          id="ask-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={ASK_BODY_MAX + 100}
          rows={6}
          placeholder="I'm a junior building an AI tutoring tool. I'd love 20 minutes with an investor who has funded EdTech to sanity-check the wedge."
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        />
        {bodyErr && <p className="text-xs text-red-400">{bodyErr}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-200">Expertise tags</span>
        <p className="text-xs text-zinc-500 -mt-1">
          Pick up to {ASK_MAX_TAGS}. We use these to suggest people who can help.
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          {INDUSTRY_SLUGS.map((slug) => {
            const on = tags.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleTag(slug)}
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
        {tooManyTags && (
          <p className="text-xs text-red-400">{ERROR_COPY.tags_too_many}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSave}
          className="bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {saving ? "Posting…" : "Post ask"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
