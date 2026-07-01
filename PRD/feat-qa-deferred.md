# feat/qa-deferred — deferred QA sweep

## Progress Update as of [June 30, 2026 — 10:14 PM Pacific]

### Summary of changes since last update
First entry. Swept the deferred QA findings (verified user-facing issues that
earlier agents flagged as outside their file scope). Confirmed each against
current code; fixed the seven still-present ones and skipped the two already
resolved. tsc/lint/tests all clean (819 tests pass).

### Detail of changes made
- `components/signed-out-panel.tsx` — "Create account" CTA pointed at
  `/sign-in?redirect_url=/dashboard` (same as "Sign in"), dead-ending new
  parents on the sign-in form. Now links to `/signup`, matching every other
  Create-account CTA (dashboard-shell, app/page).
- `app/p/[token]/page.tsx` — page-level `openGraph`/`twitter` metadata hardcoded
  `images: ["/opengraph-image.png"]`, a path that 404s because the OG card is a
  DYNAMIC file route (`app/opengraph-image.tsx`, force-dynamic → served at
  `/opengraph-image/<hash>`). Removed the hardcoded `images` so the share page
  inherits the root segment's auto-generated, correctly-hashed dynamic card.
- `lib/ask-validate.ts` — validation errors were Ask-worded ("…for your ask",
  "Describe what you need help with") but the same validators back Offer posts.
  Made copy kind-neutral: "Add a short title." / "Add some details."
- `app/api/blob/upload/route.ts` — board file picker offers .md/.csv/.txt/doc
  types; server allow-listed by exact MIME, so .md (empty/octet-stream type from
  browsers) was rejected despite being offered. Added an extension fallback
  (`BOARD_FILE_EXTENSIONS`) used only when `file.type` is empty or
  `application/octet-stream`, keeping server + picker in agreement. Kept the
  allow-list tight (no executables/archives).
- `lib/format.ts` — `formatLastUsed` absolute-date fallback used `timeZone:"UTC"`
  while admin pages render America/Los_Angeles. Switched the fallback to Pacific
  so a parent's "Last used" date matches admin timestamps; a fixed zone still
  avoids hydration drift. Updated `lib/format.test.ts` (description + a Pacific
  boundary case).
- `app/oauth/authorize/page.tsx` — consent screen `displayName` fell back to the
  raw email. Now falls back to the email local part (before "@") before the raw
  address, so a Clerk user with no first name sees a coarsened name, not their
  full address, on a third-party-initiated screen.
- `app/(authed)/dashboard/page.tsx` — "Community at a glance" tile mislabeled
  `total_children` as "Kids at OHS" (counts children marked "Not an OHS child").
  Relabeled to "Children", matching the directory stat-strip fix.

### Findings confirmed ALREADY FIXED (skipped)
- Re-verify already-verified student (`verify-actions.ts` + `student-verify.tsx`):
  `requestStudentCode` already returns `{ok:false, error:"This student is
  already verified — no code needed."}` for an exact re-verify, and the widget
  surfaces it via `setError` and stays on the email step — no false "we sent a
  code" screen. No change needed.
- Directory stat-strip label: `directory/stat-strip.tsx` already reads
  "Children" (an earlier agent relabeled it). Only the dashboard tile still said
  "Kids at OHS" — that one is fixed here.

### Not touched (owned but no change needed)
- `app/api/oauth/token/route.ts` — listed as owned, but the raw-email display
  finding lives only on the authorize page; token route needed no change.

### Potential concerns to address
- Blob upload: when a browser reports `application/octet-stream`, we still pass
  `contentType: file.type` to `put()`, so the stored object keeps octet-stream
  (forces download rather than inline view). Fine for board files (downloaded
  anyway), but worth noting if inline preview is ever wanted.
- OG inheritance for `/p/[token]` relies on Next merging the root file-based
  dynamic OG image into a child page that defines `openGraph` without `images`.
  Verified against the metadata docs/analyzer; a `next build` was intentionally
  NOT run in this worktree (per instructions) so this is reasoned, not observed.
