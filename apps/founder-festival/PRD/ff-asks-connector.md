## Progress Update as of June 30, 2026 — 12:40 AM Pacific
*(Most recent updates at top)*

### Summary of changes since last update
First entry. Built the v1 OHS "asks → expertise matching" connector, gated behind
CONNECT_MODE: a claimed member posts an "ask", a deterministic keyless matcher
ranks non-student helper profiles by expertise-tag overlap, and helpers reply
with a short offer (+ proposed format) the asker can accept/decline. New schema
(`asks`, `ask_responses`) + a `users.member_type` column, migration
`0067_orange_may_parker.sql`, three pages, four API routes, and unit tests for
all new pure logic.

### Detail of changes made:
- **Branch:** `feat/ff-asks-connector`, stacked on `feat/ff-connect-mode` (PR2).
  Merge order intended as PR #104 → #105 → this.
- **Member type (Build #1):** `users.member_type text NOT NULL DEFAULT 'community'`.
  Self-selected on /account (connect-mode only) via `MemberTypeSection` →
  `POST /api/account/member-type`. Values: student | parent | alumni | community
  (`src/lib/member-type.ts`, pure + DB-free; `isHelperType` = not student).
- **Schema (Build #2):** `asks` (id, authorEvaluationId FK→evaluations,
  authorClerkUserId, title, body, expertiseTags text[], status open|matched|closed,
  timestamps) and `ask_responses` (id, askId FK→asks, responderEvaluationId FK,
  responderClerkUserId, offer, proposes async_advice|zoom|dinner|other, status
  offered|accepted|declined, createdAt, decidedAt; unique (askId, responder)).
  Migration generated offline with `pnpm db:generate` → `0067_orange_may_parker.sql`
  (+ journal/snapshot). DB NOT pushed (no DB). `askVotes` DEFERRED.
- **Matcher (Build #3):** `src/lib/ask-matching.ts` — PURE, DB-free, deterministic,
  keyless. `rankCandidates({askTags, candidates, excludeEvaluationId, limit})`:
  excludes students + the asker, scores by case-insensitive tag-overlap count,
  drops zero-overlap, sorts score desc → factCount desc → fullName asc →
  evaluationId asc (fully stable). Clear seam to swap in AI matching later.
  DB adapter `getSuggestedHelpers` lives in `src/lib/asks.ts` (narrows to claimed,
  non-student, non-hidden profiles via `canonical_industries && askTags`).
- **Pages (Build #4, connect-mode only, else notFound):**
  - `/asks` board — open asks newest-first, expertise-tag facet filter
    (`AsksBoardFilter`, `?industry=` overlap), "Post an ask" CTA.
  - `/asks/new` — `PostAskForm` (title/body/tags), claimed users only.
  - `/asks/[id]` — the ask, "Suggested people who can help" (matcher top 8),
    helper "Offer to help" form (`OfferHelpForm`), and per-response accept/decline
    for the asker (`ResponseDecisionButtons`). On accept the asker + that helper
    see a reveal block linking the helper's profile (in-app intro path).
  - "Asks" nav item added to `SiteHeaderNav` (gated by `CONNECT_MODE_CLIENT`).
- **Routes (Build #5), all CONNECT_MODE-gated + Clerk-auth'd:**
  - `POST /api/asks` (create; claimed only; per-IP rate-limit 20/day).
  - `POST /api/asks/[id]/respond` (helper offer; non-student claimed, not own ask,
    one per helper, ask must be open; rate-limit 40/day).
  - `POST /api/asks/[id]/responses/[responseId]/decide` (asker only; accept→ask
    matched + response accepted; decline→response declined).
  - `POST /api/account/member-type`.
- **Validators:** `src/lib/ask-validate.ts` (pure) + `src/lib/ask-constants.ts`
  (DB-free proposals enum, re-exported from `asks.ts` so import sites are stable).
- **Tests:** `tests/lib/ask-matching.test.ts` (12), `ask-validate.test.ts` (8 blocks),
  `member-type.test.ts` — 32 new tests, all passing.

### Validation results (compared to base `feat/ff-connect-mode`):
- `npx tsc --noEmit`: clean (exit 0).
- `pnpm test`: 5 failed tests / 961 passed; 92 failed files / 110 passed. Base was
  5 failed / 929 passed; 92 failed files / 107 passed. SAME pre-existing failures
  (hn-tokenmaxxing ×5 + whole-file no-DATABASE_URL ×92); +3 new passing files.
- `pnpm lint`: new files add ZERO new errors; only 3 `<img>` warnings on the asks
  pages' logo, matching the identical header pattern used by every authed page.
- `pnpm build`: not run (needs a DB).

### Potential concerns to address (follow-ups):
- **DEFERRED (out of scope):** AI-powered matching, upvote ranking/sorting
  (`askVotes`), scheduling/calendar for dinners, digest/notification emails on
  new offers/accepts (recorded + shown in-app only for now), public signed-out
  ask board.
- Intro-on-accept is in-app only (profile link reveal). A Resend email to the
  helper/asker on accept is the natural next step (existing send pattern +
  `users.pref*`); left as a follow-up since wiring it non-trivially touches prefs.
- `factCount` richness tiebreak uses `canonical_industries.length` + a
  credibilityTitle bonus (cheap, no JSON parse). If a better richness signal is
  wanted, swap the projection in `getSuggestedHelpers` — the pure matcher is
  agnostic.
- Migration `0067` is generated but UNAPPLIED (no DB in this env). Prod applies it
  via the sanctioned manual-migration step, not from a worktree.
