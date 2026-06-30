# feat/student-signup-parent — Student signup must link a parent

## Progress Update as of June 29, 2026 — 11:16 PM Pacific

### Summary of changes since last update
First entry. Added a role choice to step-1 of signup (parent / guardian vs.
student) and a student-specific step-2 that requires inviting a parent/guardian.
The student parent-invite REUSES the existing co-parent invite mechanism so the
invited parent joins the SAME family. The pre-existing PARENT signup flow is
behaviorally unchanged (additive only): the new role section is hidden in
co-parent join mode and defaults to "parent", which persists no `accountType`
(identical to existing parent rows). No DB schema changes — everything rides on
the `signups.extra` jsonb. Validated: typecheck, eslint, 223 tests, prod build,
plus a live render check of both the parent and student thanks pages.

### Detail of changes made
- **`lib/options.ts`**: new `ACCOUNT_TYPE = ["parent", "student"] as const` +
  `AccountType` type. Single source of truth for the server-side membership check.
- **`app/signup/signup-form.tsx`** (step-1):
  - Bumped `DRAFT_VERSION` 2 → 3 (the `empty` shape gained `accountType`, so
    stale localStorage drafts are discarded on restore rather than merged).
  - New top "Who's signing up?" Section with a required radio (parent default /
    student). Hidden when `joinToken` is set (an invited co-parent is always a
    parent). `setAccountType` persists immediately via the autosave queue.
  - `onContinue`'s forced save now sends `accountType: joinToken ? "parent" :
    v.accountType` so the thanks page (which reads `extra.accountType`
    server-side) routes to the right step-2.
  - Continue button label is "Add Your Parent →" for the student role, else the
    unchanged "Add Your Child(ren) →".
  - The step-1 "Invite a co-parent" Section is hidden for student accounts (a
    student links their parent in step-2 instead); unchanged for parents.
- **`app/signup/actions.ts`** (server, trust boundary):
  - `SignupPatch` gains `accountType?: string`.
  - `sanitizeSignupPatch` validates it with `oneOf(ACCOUNT_TYPE, …)` and merges
    into `extra`: ONLY `"student"` is persisted; "parent"/unknown sets the key to
    `undefined`, and the `extra` merge now DELETES undefined-valued keys, so a
    parent row carries NO `accountType` (byte-for-byte the pre-existing shape).
- **`app/signup/thanks/actions.ts`**:
  - New `getStudentParentLinkStatus(signupId)` server action. Returns `isStudent`
    (false for parents — the parent path short-circuits), `hasLinkedParent` (a
    non-student member already shares the family), `hasPendingInvite` (the shared
    `extra.coParentInvitesSent` counter > 0), and `linkedParentNames`.
- **`app/signup/thanks/page.tsx`**:
  - Reads `isStudentAccount(signup.extra)`; for students renders the new
    `StudentParentForm` and a student subheading ("Add your parent / guardian")
    instead of the child `FamilyForm`. Parent branch is the original code, intact.
- **`app/signup/thanks/student-parent-form.tsx`** (new client component):
  - "Add your parent / guardian" invite UI mirroring the co-parent invite flow
    (in-app confirm dialog, same partial-send messaging). Calls the EXISTING
    `sendCoParentInvites` action → the invited parent gets `joinUrlFor(family
    invite_token)` and joins the same family via `/signup/join/[token]`.
  - "Your family" status panel (linked / pending / none) using custom icons
    (`IconGradCap`, `IconCircleCheck`, `IconClock`, `IconWarning` — no emoji).
  - "Finish →" is GATED: disabled until a parent invite has been sent this
    session OR one was already pending/linked on load — enforcing "kid accounts
    require a linked parent".
- **`lib/family-display.ts`**: widened `isStudentAccount` to accept
  `Pick<DisplayMember, "extra">` so a raw signup row (no `id`) can be classified;
  behavior unchanged.
- **Tests**: `lib/family-display.test.ts` — dropped the now-excess `id` from one
  literal and added a case for the extra-only signup-row shape. 223 pass.

### Enforcement of "kid accounts require a linked parent"
1. UI gate: the student's "Finish" is disabled until a parent is invited
   (pending) or already linked (`StudentParentForm`).
2. Status surfaced: the "Your family" panel shows linked / pending / none.
3. Privacy posture (pre-existing): the directory excludes student accounts as
   standalone cards (`lib/directory.ts` `isStudent`), so an unlinked student is
   not listed on their own — they surface under the parent once linked.
4. Server trust: the role itself is validated server-side via
   `oneOf(ACCOUNT_TYPE, …)`; the invite reuses the race-safe, lifetime-capped
   `sendCoParentInvites` primitive.

### Verification performed
- `npm run typecheck`, `npm run lint`, `npm run test` (223 pass), `npm run build`
  (compiles `/signup`, `/signup/thanks`, `/signup/join/[token]`).
- Live render check against a worktree dev server + the real DB:
  - `/signup` (default) → parent radio pre-checked, "Add Your Child(ren) →",
    co-parent + child sections present (parent path unchanged).
  - `/signup/thanks?id=<student>` → "Add your parent / guardian" + parent-invite
    input + "Your family"; NO "Add a child" / child form.
  - `/signup/thanks?id=<parent>` → child form intact; NO parent-invite UI leaked.

### Potential concerns to address
- The Finish gate is client-side (mirrors the existing parent step-2, which also
  links out via `<Link>` rather than a server-validated submit). A determined
  student could deep-link to `/signup/welcome`; the directory privacy posture
  (unlinked students aren't listed) is the real backstop. A future server-side
  gate on `getStudentParentLinkStatus` before showing the welcome page could
  harden this if desired.
- A student who sends an invite that bounces still counts as "pending" (we trust
  `coParentInvitesSent`, same as the co-parent flow). Acceptable for v1.
- `accountType` is fixed at step-1; there is no UI to switch an existing account
  between parent/student afterward (out of scope).
