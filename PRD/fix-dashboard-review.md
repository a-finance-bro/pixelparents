# Pixel Parents — Progress Log (branch: `fix/dashboard-review`)
*(Most recent updates at top)*

## Progress Update as of June 29, 2026 — 7:55 PM Pacific

### Summary of changes since last update
Fixes from an automated code review of the dashboard + verification work (PRs
#78–#82): a P0 (the Developers nav dropped users out of the persistent shell), a
P1 null-deref in the active-link check, a confusing "denied" label, a widened
verification cutoff buffer, plus mobile + contrast polish.

### Detail of changes made:
- **P0 — Developers nav left the shell:** `/developers` is a public page outside
  the (authed) shell, so clicking it made the sidebar vanish. Now the Developers
  nav item + the dashboard Developers card open `/developers` in a NEW TAB
  (external), so the shell never disappears. (components/dashboard-shell.tsx,
  app/(authed)/dashboard/page.tsx)
- **P1 — usePathname() can be null:** `pathname.startsWith(...)` could throw and
  white-screen the shell. Now null-safe: `pathname?.startsWith(...) ?? false`.
- **P1 — confusing label:** VerifiedBadge "denied" now reads "Declined" (was "Not
  verified", too close to pending's "Unverified").
- **P1 — directory cutoff buffer:** widened VERIFICATION_CUTOFF 2026-06-30 →
  2026-08-01 to safely grandfather the rollout cohort (clarified the comment that
  the compare is fixed, so grandfathered families never drop out over time).
- **P2 — mobile verified indicator:** VerifiedBadge gained a `compact` (icon-only)
  variant; the sidebar now shows it on the mobile icon rail (was hidden on mobile).
- **P2 — contrast:** sidebar account email bumped text-white/45 → /55.
- Gates: tsc clean, eslint clean, vitest 44/44 (directory).

### Potential concerns to address:
- Developers opens in a new tab (it's public docs, no Clerk/shell). In-app API key
  management still lives in-shell at /account. If a single in-shell developers page
  is wanted later, that's a follow-up.
