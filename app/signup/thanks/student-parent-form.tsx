"use client";

import Link from "next/link";
import { useState } from "react";
import { IconGradCap, IconCircleCheck, IconClock, IconWarning } from "@/components/icons";
import { parseInviteEmails } from "@/lib/invite";
import { sendCoParentInvites } from "../actions";
import type { StudentParentLinkStatus } from "./actions";

const labelCls = "block text-sm font-medium text-white/80";
const inputCls =
  "mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 outline-none transition-colors focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/60";

// Step-2 for a STUDENT account: instead of "add your children", the required
// action is "add (invite) your parent / guardian". This REUSES the exact
// co-parent invite mechanism a parent uses to invite a spouse — the invited
// parent gets a link to the SAME family's invite token and, on opening it, joins
// the same family (lib/family.joinUrlFor + /signup/join/[token] + the shared
// invite_token). The student's "Finish" is gated until at least one parent is
// invited (pending) or already linked, enforcing "kid accounts require a linked
// parent". Students do NOT add children — that's the parent path, unchanged.
export default function StudentParentForm({
  signupId,
  initialStatus,
}: {
  signupId: string;
  initialStatus: StudentParentLinkStatus;
}) {
  const [inviteRaw, setInviteRaw] = useState("");
  const [confirmEmails, setConfirmEmails] = useState<string[] | null>(null);
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  // Tracks whether a parent invite has been sent in THIS session, OR was already
  // pending/linked on load — drives the Finish gate without a server round-trip.
  const [hasParent, setHasParent] = useState(
    initialStatus.hasLinkedParent || initialStatus.hasPendingInvite,
  );

  function onInviteClick() {
    setInviteNote(null);
    const emails = parseInviteEmails(inviteRaw);
    if (emails.length === 0) {
      setInviteNote("Enter your parent or guardian's email address.");
      return;
    }
    setConfirmEmails(emails);
  }

  async function onConfirmInvite() {
    const emails = confirmEmails ?? [];
    setConfirmEmails(null);
    setInviteState("sending");
    setInviteNote(null);
    const res = await sendCoParentInvites(signupId, emails);
    if (res.ok && res.sent > 0) {
      setInviteState("sent");
      setInviteRaw("");
      setHasParent(true);
      const reserved = res.reserved ?? res.sent;
      const cappedShort = reserved < res.requested;
      const failedShort = res.sent < reserved;
      let note = `Invite sent to ${res.sent} parent / guardian. They'll get a link to add their info and join your family.`;
      if (res.sent > 1)
        note = `Sent ${res.sent} invites. They'll get a link to add their info and join your family.`;
      if (failedShort) note += ` (${reserved - res.sent} couldn't be sent — please try again.)`;
      if (cappedShort) note += ` (${res.requested - reserved} not sent — invite limit reached.)`;
      setInviteNote(note);
    } else if (res.error === "limit") {
      setInviteState("error");
      setInviteNote("You've reached the invite limit for this signup.");
    } else {
      setInviteState("error");
      setInviteNote("We couldn't send that invite. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IconGradCap className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
          <div>
            <h3 className="text-base font-semibold text-white">
              Add your parent / guardian
            </h3>
            <p className="mt-1 text-sm text-white/70">
              Student accounts need a parent or guardian linked to your family.
              Invite yours below — they&apos;ll get a private link to add their own
              info and join the same family as you.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className={labelCls} htmlFor="parentInvite">
            Your parent or guardian&apos;s email{" "}
            <span className="text-red-400">*</span>
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="parentInvite"
              type="email"
              value={inviteRaw}
              onChange={(e) => {
                setInviteRaw(e.target.value);
                if (inviteState !== "idle") setInviteState("idle");
              }}
              placeholder="parent@example.com"
              className={`${inputCls} mt-0 flex-1`}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={onInviteClick}
              disabled={inviteState === "sending"}
              className="shrink-0 rounded-lg border border-white/30 px-5 py-2 font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {inviteState === "sending" ? "…" : "Invite"}
            </button>
          </div>
          {inviteNote && (
            <p
              className={`mt-2 text-sm ${
                inviteState === "sent"
                  ? "text-emerald-300"
                  : inviteState === "error"
                    ? "text-red-300"
                    : "text-white/60"
              }`}
            >
              {inviteNote}
            </p>
          )}
        </div>
      </section>

      {/* Family status: tells the student where their parent link stands. */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="text-sm font-semibold text-white/80">Your family</h4>
        {initialStatus.hasLinkedParent ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-emerald-300">
            <IconCircleCheck className="h-4 w-4 shrink-0" />
            {initialStatus.linkedParentNames.length > 0
              ? `${initialStatus.linkedParentNames.join(", ")} ${
                  initialStatus.linkedParentNames.length === 1 ? "is" : "are"
                } linked to your family.`
              : "A parent / guardian is linked to your family."}
          </p>
        ) : hasParent ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-amber-300">
            <IconClock className="h-4 w-4 shrink-0" />
            Invite sent — waiting for your parent / guardian to join.
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <IconWarning className="h-4 w-4 shrink-0" />
            No parent / guardian linked yet. Invite one above to finish setting up
            your account.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {hasParent ? (
            <Link
              href="/signup/welcome"
              className="rounded-full bg-white px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90"
            >
              Finish →
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Invite your parent / guardian first."
              className="cursor-not-allowed rounded-full bg-white/30 px-6 py-3 font-semibold text-black/60"
            >
              Finish →
            </button>
          )}
          <span className="text-xs text-white/40">
            Everything saves automatically as you go.
          </span>
        </div>
        {!hasParent && (
          <p className="text-xs text-white/45">
            You&apos;ll be able to finish once a parent / guardian is invited.
          </p>
        )}
      </div>

      {/* Custom in-app confirmation dialog (mirrors the co-parent invite flow). */}
      {confirmEmails && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmEmails(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900 p-6 text-white shadow-2xl"
          >
            <p className="text-sm text-white/85">
              About to invite {confirmEmails.join(", ")} to join your family as your
              parent / guardian. They&apos;ll be able to view and edit your family
              information.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmEmails(null)}
                className="rounded-full border border-white/30 px-5 py-2 font-semibold text-white transition-colors hover:bg-white/10"
              >
                No, cancel
              </button>
              <button
                type="button"
                onClick={onConfirmInvite}
                className="rounded-full bg-white px-5 py-2 font-semibold text-black transition-opacity hover:opacity-90"
              >
                Yes, invite them
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
