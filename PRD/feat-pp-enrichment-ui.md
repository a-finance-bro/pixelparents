## Progress Update as of June 30, 2026 — 1:13 AM Pacific

### Summary of changes since last update
First commit on `feat/pp-enrichment-ui` (stacked on the UNMERGED
`feat/pp-enrichment-engine` / PR #107). Makes the de-scored enrichment engine
**user-facing, opt-in, and privacy-respecting**: a new personal-website field, a
default-OFF consent control at signup AND in profile settings, a non-blocking
background trigger (Next 16 `after()`) + an owner-only rate-limited manual
refresh, a full OWNER-ONLY display (info profile + facts-by-source + the
data-source status roster incl. "API key not set"), a SHARED curated-only display
gated behind a new default-OFF `profile_enrichment` share field routed through the
SAME `isDirectoryVisible`/`canViewProfile`/verification gates, and owner
edit/claim/delete that survives a refresh. Validated: `npx tsc --noEmit`,
`npm run lint`, `npm test` (270 tests), and `npm run build` all green.

### Detail of changes made:
- **`lib/enrichment/profile.ts`** (NEW, pure — no DB/network) — the bridge between
  the engine and `signups.extra`. Keys: `extra.websiteUrl`, `extra.enrichmentOptIn`
  (default OFF), `extra.enrichment` (the stored payload). Exports:
  `websiteUrlOf`, `enrichmentOptInOf`, `normalizeWebsiteUrl` (http(s)-only, adds
  https:// to bare hosts, rejects `javascript:`/`data:`/`mailto:` etc.),
  `StoredEnrichment` (= engine `FullEnrichment` + `buildStatus`/`startedAt`/
  `ownerEdit`), `mergeOwnerEdit`, `curatedEnrichmentOf` (returns ONLY bio/
  expertise/canHelpWith — never facts/statuses), `preserveOwnerEdit` (carries an
  owner edit forward across a refresh).
- **`lib/db/enrichment.ts`** — widened the persisted type to `StoredEnrichment`
  (re-exported as `FullEnrichment` for back-compat) so build-status + owner edits
  persist under `extra.enrichment`.
- **`lib/db/enrichment-trigger.ts`** (NEW, server-only) — the ONLY place runs are
  started. `shouldTrigger` (pure, tested): opt-in gate → inputs gate →
  idempotency/rate-limit (`MIN_REFRESH_MS = 60s`, in-flight vs rate-limited).
  `subjectFromSignup` builds the engine subject from public user-provided IDs only.
  `runEnrichmentForSignup(id, {force})` marks "building", runs
  `runFullEnrichment`, persists via `saveEnrichment` preserving owner edits; never
  throws (failures persist as `buildStatus:"error"` for retry).
- **`lib/share.ts`** — added `{ key: "profile_enrichment", label: "AI-built
  profile (bio & expertise)" }` to `SHARE_FIELDS`, deliberately ABSENT from
  `DEFAULT_SHARE_FIELDS` (OFF by default).
- **Signup form** (`app/signup/signup-form.tsx` + `app/signup/actions.ts`) — new
  **Personal website** input + an explicit default-OFF **enrichment opt-in
  checkbox**; both flow through `SignupPatch` (`websiteUrl`, `enrichmentOptIn`) and
  `sanitizeSignupPatch` (website normalized, opt-in only persisted when `true`).
  `completeSignup` schedules `runEnrichmentForSignup(id)` via `after()` (background,
  self-gated, no-op when not opted in).
- **Family editor** (`app/(authed)/family/member-card.tsx` + new
  `enrichment-panel.tsx` + `actions.ts`) — website field added; new OWNER-ONLY
  `EnrichmentPanel` shows the opt-in toggle, build-status indicator
  ("Building… ~1 min" → "Ready"), "Refresh profile data" button, the curated
  bio/expertise/help (inline-editable), the facts-by-source dump, the full
  data-source status roster + a "paid sources aren't enabled yet" note, and a
  delete control. New family-scoped actions: `setEnrichmentOptIn` (kicks a build
  on enable via `after()`), `refreshEnrichment` (force, still rate-limited),
  `saveEnrichmentOwnerEdit` (sets `editedByOwner`), `deleteEnrichment`. All reuse
  the existing `authorizedTarget` family-membership authorization.
- **Shared display** (`components/profile-view.tsx`) — personal-website link
  (rides the existing default-OFF `links` field) + a curated "About" section
  (bio / areas of expertise / how they can help) behind `profile_enrichment`.
  Already inside the `canViewProfile` gate, so signed-out viewers see ZERO
  enrichment PII; students keep their existing coarsening.
- **Directory** (`lib/directory.ts` + `app/(authed)/community/showcase-client.tsx`)
  — `DirectoryCard.enrichment` (curated only) populated behind `profile_enrichment`;
  the showcase card shows a 2-line bio + folds expertise tags into the chip strip.
  Raw facts / status roster are never projected onto a card.
- **Tests** (NEW + extended): `lib/enrichment/profile.test.ts` (normalize/merge/
  curated-only/owner-edit-preserved), `lib/db/enrichment-trigger.test.ts` (opt-in
  gating, idempotency/rate-limit, subject build), `lib/directory.test.ts` (+share
  gating: OFF → null, ON → curated only, never raw facts), `lib/share.test.ts`
  (+`profile_enrichment` default-OFF).

### Potential concerns to address:
- `after()` needs a serverful runtime (works on Vercel/Node). On a static export
  the callback runs at build time — N/A here (the routes are dynamic).
- The background run depends on a model key (`VERCEL_AI_GATEWAY`/`ANTHROPIC_API_KEY`)
  for the info-extract pass; without it the engine still persists facts + statuses,
  and `info` is empty (curated view is null until a key is set). Keyed paid sources
  show "API key not set" by design.
- Idempotency uses `startedAt` within a 60s window; a run that legitimately takes
  >60s could be re-triggered by a manual refresh. Acceptable (runs are bounded by
  the engine's per-enricher timeouts) but worth a follow-up if runs lengthen.
- OUT OF SCOPE (next PR, per the brief): the asks/matching port and the async paid
  BrightData collections.
