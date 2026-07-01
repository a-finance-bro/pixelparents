# feat/help-v2 — Help + Onboarding + Feedback surface

## Progress Update as of [June 30, 2026 — 8:58 PM Pacific]

### Summary of changes since last update
Added the ADMIN FEEDBACK TRIAGE surface + nav badge. Piece 1 (feedback storage +
widget + admin) is now complete end to end.

### Detail of changes made:
- `app/(authed)/admin/feedback/page.tsx` — lists feedback newest-first (coarsened
  submitter #id, message, page path, date, status badge) with per-row Mark
  reviewed / Mark resolved / Reopen forms; "N new" header pill; DB-less + non-admin
  guards mirror /admin/reports.
- `app/(authed)/admin/feedback/actions.ts` — `updateFeedbackStatus` (admin-gated,
  validates status via isFeedbackStatus, revalidates the page).
- `app/(authed)/admin/admin-nav.tsx` — added `{href:"/admin/feedback",
  label:"Feedback"}` with an open-count (status='new') badge; nav now takes
  `openFeedback` alongside `openReports`.
- `app/(authed)/admin/layout.tsx` — fetches countOpenFeedback() in parallel with
  openReportCount() (admins only, self-healing → 0) and threads it to AdminNav.

### Potential concerns to address:
- The floating help (?) button, help menu, GitHub dialog, FAQ, and walkthrough
  tour are the remaining commits.

## Progress Update as of [June 30, 2026 — 8:52 PM Pacific]

### Summary of changes since last update
Built the FEEDBACK WIDGET and wired it + walkthrough `data-tour` anchors into the
app shell and dashboard. The "Send feedback" entry is now pinned directly above
the account chip on the desktop rail and inside the mobile More drawer.

### Detail of changes made:
- `components/feedback-widget.tsx` — `FeedbackComposer` (textarea + Send +
  "Thanks — sent!" confirmation; captures window.location.pathname at submit,
  maxLength = MAX_FEEDBACK_MESSAGE, calls submitFeedbackAction) and
  `FeedbackWidget` (a compact trigger opening a popover with the composer;
  Escape + click-outside dismiss; `variant` "sidebar" | "drawer"). Carries
  `data-tour="feedback"` for the walkthrough.
- `components/dashboard-shell.tsx` — imported + rendered `<FeedbackWidget>`
  directly above the account chip in `accountBlock` (both desktop + drawer);
  wrapped the NotificationBell in `data-tour="notifications"`; added
  `data-tour="account"` to the account settings Link.
- `app/(authed)/dashboard/page.tsx` — `LinkCard` gained an optional `tourId` →
  `data-tour`; the six Explore cards now carry `explore-community`,
  `explore-directory`, `explore-events`, `explore-resources`, `explore-family`,
  `explore-developers` (reordered to the tour sequence). Grid already had all
  six items — no card was missing.

### Potential concerns to address:
- The help (?) button, help menu, GitHub dialog, FAQ, and walkthrough tour are
  the next commits; the tour will consume the data-tour anchors added here.

## Progress Update as of [June 30, 2026 — 8:43 PM Pacific]

### Summary of changes since last update
First commit on the branch: the FEEDBACK DATA LAYER. Adds a self-contained,
self-healing `feedback` table (mirrors the reports.ts / notifications.ts pattern),
its Drizzle schema, the submit server action (signed-in + verified gate, sanitize
+ cap, best-effort admin email notify), and pure-logic unit tests. No UI yet.

### Detail of changes made:
- `lib/db/schema/feedback.ts` — Drizzle `feedback` table (id, author_signup_id,
  author_clerk_id, message, page_path, status default 'new', created_at) + a
  created_at index; re-exported from `lib/db/schema/index.ts`.
- `lib/db/feedback.ts` — self-contained `ensureFeedbackTable()` (idempotent
  CREATE TABLE IF NOT EXISTS + index, NOT in shared ensure.ts), plus
  `createFeedback`, `listFeedback`, `setFeedbackStatus`, `countOpenFeedback`,
  `isFeedbackStatus`, and a pure `sanitizeFeedbackMessage` (trim + hard-cap at
  MAX_FEEDBACK_MESSAGE = 2000). Every read/write ensures the table first;
  DB-less calls degrade to []/0 like the other data layers.
- `app/(authed)/feedback-actions.ts` — `submitFeedbackAction({message, pagePath})`:
  resolves the author server-side from Clerk (currentUser → primaryEmail →
  signup); requires signed-in + verified family (admins always pass; otherwise
  any verified OHS student in the family, same union rule as the layout gate);
  sanitizes/caps the message; cleans page_path to in-app "/…" only; persists;
  best-effort admin email via `after()` (env-driven Resend, no hardcoded PII).
- `lib/db/feedback.test.ts` — covers isFeedbackStatus (accept/reject/narrow) and
  sanitizeFeedbackMessage (trim, blank, line breaks, hard cap, nullish).

### Potential concerns to address:
- The env name for the WhatsApp link in the repo is
  `NEXT_PUBLIC_DRODIO_WHATSAPP_URL` (the build brief said
  `NEXT_PUBLIC_WHATSAPP_URL`); the GitHub dialog will use the EXISTING repo name
  to stay consistent. The phone will come from `NEXT_PUBLIC_DRODIO_PHONE` with a
  graceful "omit if unset" fallback (never hardcoded).
- `next build` intentionally NOT run in the worktree (per directive); validating
  with tsc + lint + vitest only.
- UI pieces (widget, admin triage, floating help, walkthrough tour) land in
  subsequent commits.
