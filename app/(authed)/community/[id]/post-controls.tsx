"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IconPencil, IconTrash, IconCircleCheck, IconCheck } from "@/components/icons";
import { deleteAskAction, setAskResolvedAction } from "../actions";

// Creator-only management bar for an Community post: edit (link to the edit page),
// mark resolved / reopen (toggles status), and delete (behind a confirm dialog).
// All three server actions re-check authorship server-side; this is just the UI.
export function PostControls({
  id,
  resolved,
}: {
  id: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic "just resolved" flag — drives the checkmark morph + glow sweep
  // before the refresh reveals the resolved state. Only set when resolving (not
  // when reopening), since the celebratory moment is the resolution itself.
  const [justResolved, setJustResolved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleResolved = () => {
    setError(null);
    const willResolve = !resolved;
    if (willResolve) setJustResolved(true); // optimistic morph
    startTransition(async () => {
      const res = await setAskResolvedAction({ id, resolved: willResolve });
      if (res.ok) {
        const reveal = () => router.refresh();
        if (reduce || !willResolve) reveal();
        else setTimeout(reveal, 620); // let the sweep play
      } else {
        setJustResolved(false); // roll back
        setError(res.error);
      }
    });
  };

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAskAction({ id });
      if (res.ok) {
        router.push("/community");
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/community/${id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/5"
        >
          <IconPencil className="h-4 w-4" /> Edit
        </Link>

        <div className="relative">
          {/* Emerald glow sweep when a post is resolved. */}
          <AnimatePresence>
            {justResolved && !reduce && (
              <motion.span
                aria-hidden
                initial={{ x: "-120%", opacity: 0 }}
                animate={{ x: "120%", opacity: [0, 1, 0] }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent blur-sm"
              />
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggleResolved}
            disabled={pending}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              justResolved
                ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                : "border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {justResolved ? (
                <motion.span
                  key="done"
                  initial={reduce ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 18 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <IconCheck className="h-4 w-4" strokeWidth={3} /> Resolved
                </motion.span>
              ) : (
                <motion.span key="idle" initial={false} className="inline-flex items-center gap-1.5">
                  <IconCircleCheck className="h-4 w-4" />
                  {resolved ? "Reopen" : "Mark resolved"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
        >
          <IconTrash className="h-4 w-4" /> Delete
        </button>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4"
        >
          <p className="text-sm text-white/85">Delete this post? This can&apos;t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className="rounded-full bg-red-400 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-red-300 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
