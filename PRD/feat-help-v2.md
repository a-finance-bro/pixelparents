# feat/help-v2 — Help + Onboarding + Feedback surface

## Progress Update as of [June 30, 2026 — 8:56 PM Pacific]

### Summary of changes since last update
Hardened the walkthrough tour: a target that's present but laid out at 0×0 (e.g.
the sidebar feedback/account entries are `hidden md:flex` on phones) is now
treated like a missing target and skipped, so the tour never spotlights an
invisible box on small viewports. tsc + lint clean.

### Detail of changes made:
- `components/walkthrough-tour.tsx` — the measure step now skips when the target's
  getBoundingClientRect is 0×0 (advances, or finishes if it was the last step).

## Progress Update as of [June 30, 2026 — 8:54 PM Pacific]

### Summary of changes since last update
Built pieces 2 (floating help ? button + menu + GitHub/FAQ dialogs) and 3
(guided walkthrough tour), and mounted both in the shell (authed only). All four
cohesive pieces are now implemented. Full suite green: tsc clean, lint clean,
754 tests pass.

### Detail of changes made:
- `components/walkthrough-steps.ts` — pure step model: `TOUR_STEPS` (intro → six
  Explore cards → notifications → feedback → account → outro), `TOUR_STORAGE_KEY`,
  and pure helpers `clampStep`/`isFirstStep`/`isLastStep`/`primaryLabel`.
- `components/walkthrough-steps.test.ts` — 9 tests over the sequence + nav math.
- `components/walkthrough-tour.tsx` — the overlay: spotlight ring (box-shadow
  "hole" dimming + blur, blur dropped under prefers-reduced-motion), instructional
  card (title/body, Back/Next/Skip, progress dots), started via a
  `pp:start-walkthrough` window event (`startWalkthrough()`), navigates to
  /dashboard on start, scrolls targets into view, skips missing targets, Escape/
  click-out to exit, persists a localStorage completed flag. Renders nothing until
  started.
- `components/help-menu.tsx` — presentational stacked-strip menu (Begin
  walkthrough, FAQ, Privacy, Terms, Changelog, Send feedback, GitHub).
- `components/help-button.tsx` — the floating "?" button (fixed bottom-right,
  above the mobile tab bar, safe-area aware; a data-help-button media rule pulls
  it to the corner on md+), toggling the menu and orchestrating the FAQ/GitHub/
  feedback overlays.
- `components/faq-dialog.tsx` — 7 real Q&As (what it is, who for, verification,
  public vs private, connecting, contributing, joining the builder group) as an
  accessible accordion dialog.
- `components/github-dialog.tsx` — "built in the open" dialog: WhatsApp builder
  group (NEXT_PUBLIC_DRODIO_WHATSAPP_URL, the existing repo env name), message
  Daniel to be added showing NEXT_PUBLIC_DRODIO_PHONE ONLY when set (graceful
  omit otherwise — never hardcoded), and the repo link.
- `components/dashboard-shell.tsx` — mounts `<HelpButton>` + `<WalkthroughTour>`
  for authed users.
- `.env.example` — documented `NEXT_PUBLIC_DRODIO_PHONE` (placeholder, no real
  value).
- `vitest.config.ts` — include now also matches `components/**/*.test.ts` (needed
  to run the tour step-model tests, which colocate with the component).

### Potential concerns to address:
- Env name mismatch vs brief: brief said `NEXT_PUBLIC_WHATSAPP_URL`; the repo
  already standardizes on `NEXT_PUBLIC_DRODIO_WHATSAPP_URL`, so the GitHub dialog
  uses the existing name for consistency (both are graceful-fallback).
- `next build` intentionally NOT run in the worktree (per directive). Verified
  via tsc + lint + vitest only; no browser preview run.
- The tour's rect measurement uses fixed timings (220ms after smooth scroll);
  robust in practice but a very slow route transition could momentarily mis-place
  the card before the next tick recomputes.

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
