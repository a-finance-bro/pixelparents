# Pixel Parents — Progress Log (branch: `feat/family-autolink-flagged`)
*(Most recent updates at top)*

## Progress Update as of June 29, 2026 — 10:00 PM Pacific

### Summary of changes since last update
First commit on the branch. Two independent, **flag-gated, default-OFF** features:
(A) auto-linking families that share an OHS student email by MERGING them into the
oldest family, and (B) a forced verification gate that bounces unverified families
to /verify. With BOTH flags unset, behavior is identical to today — merging this
branch changes nothing until a flag is set.

### Flags (both default OFF — documented in `.env.example`)
- **`FAMILY_AUTOLINK_ENABLED`** — when `"true"`, `confirmStudentCode` merges other
  families sharing the verified student email. Unset/anything-else → no merge.
- **`FAMILY_FORCE_VERIFY`** — when `"true"`, the `(authed)` layout redirects an
  authed user who HAS a signup but ZERO verified students to `/verify?required=1`.
  Unset/anything-else → no gating.

### Detail of changes made
- **`lib/family-merge.ts`** (new) — `mergeFamiliesByVerifiedEmail(verifierFamilyId, email)`:
  - Finds OTHER families (family_id <> verifier) already carrying the email across
    three sources, all lowercased: `signups.extra->>'verifiedStudentEmail'`,
    `signups.extra->'verifiedStudentEmails'` (jsonb array, element-wise lowercased
    match via `jsonb_array_elements_text`), and `children.student_email`.
  - None found → no-op `{ merged: false }` (idempotent + self-match-safe).
  - Canonical = OLDEST family (min `families.created_at`, tie-break smaller id).
    Repoints the other families' `signups.family_id` + `children.family_id` →
    canonical. Soft-orphan: the orphaned `families` row is NOT deleted; children
    are NOT auto-deduped.
  - Family-wide approves the canonical for the email — mirrors `confirmStudentCode`'s
    approve UPDATE verbatim (singular + plural verifiedStudentEmail(s), dedup,
    additive approvalBy/At) keeping the `<> 'denied'` guard.
  - Appends an audit entry per merged family to the canonical family's newest
    signup `extra.merges` (`{from, email, at}`).
  - Writes run in ONE `sql.transaction([...])` (neon-http exposes `.transaction`;
    falls back to back-to-back awaits if absent). Pure decision helpers exported:
    `pickCanonicalFamily`, `familiesToRepoint`, `lowerEmail`.
- **`lib/family-merge.test.ts`** (new) — unit tests for the pure bits only (the DB
  path needs a live Neon, same convention as the rest of `lib/*.test.ts`). 17
  cases: oldest-wins, order-independence, tie-break, Date vs ISO, self-match-safe
  repoint, dedup/sort, email normalization. Total suite: 189/189.
- **`app/signup/thanks/verify-actions.ts`** — `confirmStudentCode` calls
  `mergeFamiliesByVerifiedEmail(row.familyId, email)` AFTER the existing
  approve/append/children UPDATEs, ONLY when `FAMILY_AUTOLINK_ENABLED === "true"`,
  wrapped in try/catch so a merge failure never blocks the primary approval.
- **`proxy.ts`** — sets an `x-pathname` REQUEST header (via
  `NextResponse.next({ request: { headers } })`) so the layout can know the current
  route (Next layouts can't read the pathname directly). Additive + harmless; not
  sent to the client; read only when the gate flag is on.
- **`app/(authed)/layout.tsx`** — now async; `enforceVerificationGate()` runs first.
  Flag off → early return (no-op). Flag on → caller→family→family-wide verified
  emails (`verifiedEmailsOf` across all members); admins exempt; skips when on
  `/verify`; users with no signup pass through; redirects unverified families to
  `/verify?required=1`. Re-throws `NEXT_REDIRECT`; other errors fail open (logged).
- **`app/(authed)/verify/page.tsx`** — accepts `searchParams`; when `?required=1`
  and not yet approved, shows a "Verify your OHS student to continue" banner. The
  page has no "I'll verify later" affordance to suppress (that link lives on
  `app/signup/thanks/page.tsx`, outside `(authed)`), so required mode simply adds
  the banner and offers no escape hatch.
- **`.env.example`** — documented both flags (empty/off, with comments). No PII.

### Validation
- `npm run typecheck` clean, `npm run lint` clean, `npm test` 189/189, `npm run build` OK.

### How to test the father→son link once enabled (`FAMILY_AUTOLINK_ENABLED=true`)
1. Father signs up (family A, created first). Son / other parent signs up
   separately (family B, created later) — two distinct `family_id`s.
2. One of them verifies the SAME OHS student email via the verify widget (enter the
   student's stanford.edu email, confirm the emailed 6-digit code).
3. On confirm, the merge fires: family B's signups + children are repointed to
   family A (the older, canonical family); family A is family-wide approved for the
   email; an audit `{from: B, email, at}` is appended to A's newest signup
   `extra.merges`. Family B's `families` row remains (soft orphan).
4. Verify in `/family` or `/admin`: father + son now appear under one family;
   re-running the verify is a no-op (idempotent).

### Potential concerns to address
- The `x-pathname` header relies on the proxy matcher covering `(authed)` routes —
  it does (the matcher runs on everything except static assets). If the gate ever
  fails to fire because the header is missing, `enforceVerificationGate` fails
  open (no redirect) rather than locking users out.
- The merge's family-wide approve uses the `<> 'denied'` guard (mirrors
  `confirmStudentCode`), so it may re-stamp `approvalBy` to `student-email` on an
  already-approved canonical family — status stays approved; provenance shift is
  the same trade-off the existing code already makes.
- `extra.merges` audit lives on the canonical family's NEWEST signup row to avoid
  duplicating the array across co-parents; readers should look there.
- No DB columns added — everything uses `extra` (per conventions). No migration.
