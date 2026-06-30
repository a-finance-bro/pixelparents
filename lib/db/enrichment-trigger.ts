// Server-only orchestration for KICKING OFF an enrichment run for a signup.
// Pulls the signup's inputs (name, LinkedIn, website, GitHub), checks the opt-in
// + a rate limit, marks the row "building", runs the (de-scored) engine, and
// persists the result — preserving any owner edits across a refresh.
//
// This is the ONLY place enrichment runs are started. It is:
//   • OPT-IN gated   — never runs unless extra.enrichmentOptIn === true.
//   • idempotent     — a run already in flight (startedAt within the window)
//                      short-circuits, so a double submit / `after()` retry is safe.
//   • rate-limited   — a manual refresh can't be spammed (MIN_REFRESH_MS).
//   • privacy-safe   — only public, user-PROVIDED sources (the engine's registry);
//                      no school systems are ever touched.
//
// Designed to be invoked fire-and-forget from Next's `after()` (signup complete /
// profile save) or a manual owner-only refresh action — it never throws to the
// caller; failures are recorded as buildStatus "error" for a retry.

import { getDb } from "@/lib/db";
import { signups } from "@/lib/db/schema/signups";
import { eq } from "drizzle-orm";
import { runFullEnrichment } from "@/lib/enrichment/subject";
import type { EnrichmentSubject } from "@/lib/enrichment/types";
import { saveEnrichment, getEnrichment } from "@/lib/db/enrichment";
import {
  enrichmentOptInOf,
  websiteUrlOf,
  preserveOwnerEdit,
  type StoredEnrichment,
} from "@/lib/enrichment/profile";

// A manual refresh is rate-limited: a new run can't start within this window of
// the previous run's start. Also the idempotency window for an in-flight run.
export const MIN_REFRESH_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Decide whether a run may start, given the opt-in flag, the available inputs,
// and the time since the last run. Pure + exported so it's unit-testable without
// a DB. `now`/`force` are injectable for tests + the manual button.
export type TriggerDecision = { run: boolean; reason: string };

export function shouldTrigger(opts: {
  optedIn: boolean;
  hasInputs: boolean;
  lastStartedAt?: string | null;
  now?: number;
  force?: boolean;
}): TriggerDecision {
  if (!opts.optedIn) return { run: false, reason: "not-opted-in" };
  if (!opts.hasInputs) return { run: false, reason: "no-inputs" };
  const now = opts.now ?? Date.now();
  const last = opts.lastStartedAt ? Date.parse(opts.lastStartedAt) : NaN;
  if (Number.isFinite(last) && now - last < MIN_REFRESH_MS) {
    // A recent run is in flight or just finished. A non-forced trigger (signup
    // `after()`) defers to it; a forced manual refresh is still rate-limited.
    return { run: false, reason: opts.force ? "rate-limited" : "in-flight" };
  }
  return { run: true, reason: "ok" };
}

// Build the engine subject from a signup's columns + extra. Only user-PROVIDED
// public identifiers — name, LinkedIn, personal website, GitHub username.
export function subjectFromSignup(row: {
  firstName: string;
  lastName: string;
  linkedinUrl: string | null;
  githubUsername: string;
  extra: Record<string, unknown> | null;
}): EnrichmentSubject {
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || null;
  return {
    name,
    linkedinUrl: row.linkedinUrl?.trim() || null,
    websiteUrl: websiteUrlOf(row.extra),
    githubUsername: row.githubUsername?.trim() || null,
  };
}

// Does this subject have ANYTHING for the engine to work with?
export function subjectHasInputs(s: EnrichmentSubject): boolean {
  return Boolean(s.name || s.linkedinUrl || s.websiteUrl || s.githubUsername);
}

export type RunResult = { ran: boolean; reason: string };

// Kick off (and await) an enrichment run for a signup, honoring the opt-in +
// idempotency/rate-limit. `force` is set by the manual owner-only refresh button
// (still rate-limited). Best-effort: never throws — a failure is persisted as
// buildStatus "error" so the owner can retry. Returns whether it ran + why.
export async function runEnrichmentForSignup(
  signupId: string,
  opts: { force?: boolean } = {},
): Promise<RunResult> {
  if (!UUID_RE.test(signupId)) return { ran: false, reason: "bad-id" };

  let row:
    | {
        firstName: string;
        lastName: string;
        linkedinUrl: string | null;
        githubUsername: string;
        extra: Record<string, unknown> | null;
      }
    | undefined;
  try {
    [row] = await getDb()
      .select({
        firstName: signups.firstName,
        lastName: signups.lastName,
        linkedinUrl: signups.linkedinUrl,
        githubUsername: signups.githubUsername,
        extra: signups.extra,
      })
      .from(signups)
      .where(eq(signups.id, signupId))
      .limit(1);
  } catch (err) {
    console.error("runEnrichmentForSignup: load failed", err);
    return { ran: false, reason: "load-failed" };
  }
  if (!row) return { ran: false, reason: "not-found" };

  const extra = (row.extra ?? {}) as Record<string, unknown>;
  const subject = subjectFromSignup(row);
  const previous = (await getEnrichment(signupId)) as StoredEnrichment | null;

  const decision = shouldTrigger({
    optedIn: enrichmentOptInOf(extra),
    hasInputs: subjectHasInputs(subject),
    lastStartedAt: previous?.startedAt ?? null,
    force: opts.force,
  });
  if (!decision.run) return { ran: false, reason: decision.reason };

  // Mark "building" up front (idempotency: a concurrent trigger sees startedAt
  // within the window and short-circuits). Preserve the prior payload/edits.
  const startedAt = new Date().toISOString();
  await saveEnrichment(signupId, {
    ...(previous ?? emptyStored(subject)),
    subject,
    buildStatus: "building",
    startedAt,
  } as StoredEnrichment);

  try {
    const fresh = await runFullEnrichment(subject);
    const merged = preserveOwnerEdit(fresh, previous);
    await saveEnrichment(signupId, { ...merged, startedAt });
    return { ran: true, reason: "ok" };
  } catch (err) {
    console.error("runEnrichmentForSignup: run failed", err);
    try {
      await saveEnrichment(signupId, {
        ...(previous ?? emptyStored(subject)),
        subject,
        buildStatus: "error",
        startedAt,
      } as StoredEnrichment);
    } catch (err2) {
      console.error("runEnrichmentForSignup: error-persist failed", err2);
    }
    return { ran: false, reason: "run-failed" };
  }
}

// A minimal stored shape for the "building"/"error" placeholder before the first
// successful run, so the owner sees a status indicator immediately.
function emptyStored(subject: EnrichmentSubject): StoredEnrichment {
  return {
    enrichedAt: new Date().toISOString(),
    subject,
    info: {
      identity: {
        name: subject.name ?? null,
        headline: null,
        currentRole: null,
        currentCompany: null,
        location: null,
        education: [],
      },
      bio: "",
      expertiseTags: [],
      canHelpWith: [],
    },
    infoExtracted: false,
    factsBySource: [],
    statuses: [],
    citations: [],
  };
}
