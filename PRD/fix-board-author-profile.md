## Progress Update as of [June 30, 2026 — 3:41 AM Pacific]

### Summary of changes since last update
First entry. Fixed the Community board post-detail "POSTED BY" author card wrongly
showing "This member hasn't shared a public profile." for STUDENT authors who DO
have a shareable (shareEnabled + shareVisibility "ohs") profile. Root cause: the
card reused `isDirectoryVisible`, which intentionally excludes student accounts
(they get no standalone directory grid card). Added a student-inclusive predicate
`hasShareableProfile` and switched the author + responder profile-link gates to it,
plus rendered the author's shared links/contact inline.

### Detail of changes made:
- `lib/directory.ts`: NEW exported `hasShareableProfile(row)` — same checks as
  `isDirectoryVisible` (shareEnabled + shareToken + non-blank firstName +
  isFamilyVerified + canViewProfile("…", {isOwner:false, isOhsFamily:true})) but
  WITHOUT the `!isStudentAccount` exclusion. `isDirectoryVisible` left untouched.
- `lib/directory.test.ts`: added a `hasShareableProfile` describe block. Key case
  proves a student with shareEnabled+ohs returns true for `hasShareableProfile`
  but false for `isDirectoryVisible`; plus parent-agreement, private, disabled/no-
  token/blank-name, and unverified-after-cutoff cases. Full suite: 325 passing.
- `app/(authed)/community/[id]/page.tsx`:
  - Author profile-link token now gated by `hasShareableProfile` (was
    `isDirectoryVisible`). Responder tokens likewise.
  - Computes the author's SHARED contact + links honoring `shareFieldsOrDefault`:
    email/phone behind "email"/"phone"; LinkedIn/GitHub/website behind the
    default-OFF "links" field (GitHub built from username, website via
    `websiteUrlOf`). Rendered inline in the "POSTED BY" card with icons.
  - "View profile" link still points at `/directory/<token>` (that page gates only
    on the VIEWER being an OHS family; `ProfileView` already renders a student
    token with coarsening — first name only, region not city, no children).
  - "This member hasn't shared a public profile." now only shows when the author
    genuinely hasn't (no shareEnabled / private).
- `app/(authed)/community/page.tsx` (board list): NO change needed — it renders
  only author name + parent/student badge, never a profile link/token, so there is
  no gate to fix there.

### Validation:
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean (no new errors).
- `npm test`: 325 passing (29 files), incl. the new predicate tests.
- `npm run build`: NOT run — known Turbopack "symlink points out of filesystem
  root" limitation in this symlinked-node_modules worktree; unrelated to the
  change. Relying on typecheck + lint + test per the task guidance.

### Potential concerns to address:
- The viewer is guaranteed a verified OHS family by the page's early `!isVerified`
  return, so the author's "ohs" visibility resolves and `hasShareableProfile`'s
  `isOhsFamily:true` assumption holds. If that guard is ever removed, the inline
  contact/link rendering would need its own viewer-side gate.
- Inline contact mirrors `/p` ProfileView field gating by hand (email/phone/links)
  rather than reusing a single shared helper; if the per-field contact rules change
  on the profile, keep this card in sync (or extract a shared helper later).
