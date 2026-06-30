"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IconCheck } from "@/components/icons";
import { decideResponseAction } from "../actions";

// Accept / decline buttons shown to the ASKER on a pending offer. The action is
// server-authorized (only the asker can decide on their own ask's responses);
// these buttons are just the UI.
//
// Accepting is the app's core "two-way help" payoff, so it gets an optimistic,
// satisfying beat: the Accept button morphs into a checkmark and an emerald glow
// sweeps across the row before the page refreshes to reveal the connection. On
// error we surface it and the optimistic state is discarded by the refresh path
// never running. Under reduced motion the morph/sweep are skipped (instant).
export function ResponseDecision({ responseId }: { responseId: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  const decide = (decision: "accepted" | "declined") => {
    setError(null);
    if (decision === "accepted") setAccepted(true); // optimistic morph
    startTransition(async () => {
      const res = await decideResponseAction({ responseId, decision });
      if (res.ok) {
        // Let the glow sweep play, then reveal the connection.
        const reveal = () => router.refresh();
        if (reduce) reveal();
        else setTimeout(reveal, 620);
      } else {
        setAccepted(false); // roll back the optimistic state
        setError(res.error);
      }
    });
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {/* Emerald glow sweep on accept. */}
      <AnimatePresence>
        {accepted && !reduce && (
          <motion.span
            key="sweep"
            aria-hidden
            initial={{ x: "-120%", opacity: 0 }}
            animate={{ x: "120%", opacity: [0, 1, 0] }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={pending || accepted}
        onClick={() => decide("accepted")}
        animate={
          accepted
            ? { backgroundColor: "#34d399" }
            : { backgroundColor: "#fbbf24" }
        }
        transition={{ duration: 0.25 }}
        className="relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-100"
      >
        <AnimatePresence mode="wait" initial={false}>
          {accepted ? (
            <motion.span
              key="done"
              initial={reduce ? false : { scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              className="inline-flex items-center gap-1.5"
            >
              <IconCheck className="h-4 w-4" strokeWidth={3} /> Accepted
            </motion.span>
          ) : (
            <motion.span key="accept" initial={false} exit={{ opacity: 0 }}>
              Accept
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <button
        type="button"
        disabled={pending || accepted}
        onClick={() => decide("declined")}
        className="relative z-10 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-50"
      >
        Decline
      </button>
      {error && <span className="relative z-10 text-sm text-red-300">{error}</span>}
    </div>
  );
}
