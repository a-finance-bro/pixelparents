"use client";

import Link from "next/link";
import { IconSparkles } from "@/components/icons";

// The prominent "Connect with <Name>" call-to-action shown near a member's name
// on their Directory profile (see components/profile-view.tsx). Daniel's #d5u7YmwJ
// feedback: make it OBVIOUS how to connect with a specific person from their
// profile, without navigating elsewhere first.
//
// This is intentionally a thin client button: it links to the shared "I need
// help" composer (/community/new), pre-scoped to THIS person via query params:
//   • connect = the target's signup id (server re-authorizes it as a mentionable,
//     verified member, then pre-inserts an @-mention so they're notified on submit
//     via the existing community_mention path — no new post model).
//   • name    = the coarsened display name (student = first name only), used only
//     as a fallback label; the server always re-resolves the authoritative name.
//   • topics  = the person's own interests/expertise, offered as click-to-select
//     topic chips in the composer so the user picks context with taps.
//
// The parent (profile-view) decides visibility: it renders this ONLY for a
// signed-in viewer who is not the profile owner, so we never show "connect with
// yourself" and a signed-out viewer never reaches it.
export function ConnectCta({
  signupId,
  name,
  topics,
}: {
  signupId: string;
  name: string;
  topics: string[];
}) {
  const params = new URLSearchParams();
  params.set("connect", signupId);
  if (name) params.set("name", name);
  if (topics.length > 0) params.set("topics", topics.slice(0, 12).join(","));

  // First name only for a friendlier, tappable label (full name would wrap on a
  // phone). Falls back to a generic label if the name is blank.
  const short = name.trim().split(/\s+/)[0] || "this member";

  return (
    <Link
      href={`/community/new?${params.toString()}`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-amber-300 sm:w-auto"
    >
      <IconSparkles className="h-4 w-4" />
      Connect with {short}
    </Link>
  );
}
