## Progress Update as of [June 30, 2026 — 9:56 PM Pacific]

### Summary of changes since last update
First entry for `feat/qa-resources`. Fixed the four verified QA findings for the
Resource Boards feature (create/contribute/upload/pin/edit/upvote/follow),
strictly within the owned files (`app/(authed)/resources/**`,
`lib/db/resources.ts`, `lib/resources-label.ts`). All 800 tests pass; tsc + lint
clean. `next build` was intentionally NOT run in the worktree.

### Detail of changes made:
- **Finding 1 (medium) — pinned boards not sorted to the top on the index.**
  `sortBoards()` in `lib/resources-label.ts` re-ranked everything by Hot/Top/New
  and ignored the `pinned` flag, so a board with a "Pinned" badge could sink into
  the middle. Added `pinned?: boolean` to `Rankable` and a primary
  `Number(b.pinned) - Number(a.pinned)` comparator that runs BEFORE the mode
  comparison in every branch (new/top/hot), matching the DB's `ORDER BY pinned
  DESC` intent. `resources-client.tsx` already spreads `...b` into the rankable,
  so `pinned` now flows through with no page change. Added 5 tests.
- **Finding 2 (medium) — legacy "General" board attributed to a random early
  contributor.** `migrateLegacyResources()` in `lib/db/resources.ts` seeded the
  auto-created community board with the earliest legacy row's author, giving that
  member edit/delete rights over a shared board. Now seeds it with a nil-UUID
  system owner (`SYSTEM_BOARD_OWNER = 00000000-...-000000000000`) and a null
  clerk id. Since `updateBoard`/`deleteBoard` scope every mutation to
  `author_signup_id` and no real signup carries the nil UUID, the board can no
  longer be renamed or deleted by any member; `isMine` never matches it and the
  page falls back to "A community member" for its display name. The earliest-
  legacy-author SELECT was removed (each migrated contribution still keeps its own
  real author via the CTE). Added 2 tests.
- **Finding 3 (low) — deleting "General" strands migrated resources.** Resolved
  as a consequence of Finding 2: with the nil-UUID owner, no user can delete the
  General board through the app (delete is owner-scoped), so the cascade-and-
  strand scenario is structurally prevented — the cleaner of the two suggested
  fixes ("block deletion of the system board"). No extra re-migration code added.
- **Finding 4 (low) — silent follow-toggle failure.** `board-client.tsx`
  `toggleFollow` optimistically flipped state and silently reverted on error.
  Added a `followError` state (mirroring `ContributionItem`'s inline `error`
  pattern), set it in both the `!res.ok` and thrown-action rollback branches, and
  render it as an inline `role="alert"` message under the board header meta row.

### Potential concerns to address:
- Finding 2 relies on the nil UUID being a valid `uuid` value that no real signup
  can hold (true — Clerk/signup ids are random v4 UUIDs). If a future admin-only
  management path is wanted for the General board, gate it on `isAdminEmail`
  rather than ownership.
- The migration test drives the mocked `sql` queue past the 18 DDL statements by
  returning a nonzero count for every unmatched call and asserting on the issued
  SQL (`lastCallMatching`) rather than exact queue positions — robust to DDL
  statement-count drift except for the two explicit index slots (19/20). If the
  DDL block grows, revisit those indices.
- `next build` was not run per instructions; only tsc/lint/vitest were validated.
