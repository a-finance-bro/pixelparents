# Pixel Parents — Progress Log (branch: `worktree-developer-api`)
*(Most recent updates at top)*

## Progress Update as of June 15, 2026 — 8:58 PM Pacific

### Summary of changes since last update
Deployed the Developer API to production and made `api_keys` **self-healing** to
survive the multi-agent shared-DB collision. The API is live and fully working at
https://pixelparents.org/developers.

### Detail of changes made:
- **Deployed to prod:** merged developer-api into `main` (`76e25b0`), pushed, and
  Vercel auto-deployed. `/developers` page + all API endpoints are live.
- **Neon wired up:** the user provisioned Neon ("neon-rose-planet") via the Vercel
  integration — `DATABASE_URL` (+ POSTGRES_*/PG*) is in Vercel env (Prod/Preview/Dev)
  and in the primary repo's `.env.local`. Created `api_keys` via `scripts/db-setup.mjs`.
- **End-to-end verified in prod:** issue key → 201; `/api/v1/me` → 200 (tier public);
  `/api/v1/stats` → 200 (`database:"ready"`); `/api/v1/breakdowns` → 403 approval_required;
  bad key → 401.
- **Root-caused the 503s:** NOT env/deploy. The `api_keys` table was being **dropped**
  by a parallel agent's `drizzle-kit push` (its schema doesn't include api_keys, so push
  treats it as orphaned). Same DB holds `signups`/`children` (signup agent) — mutual
  destruction risk between two partial schemas pushing to one Neon DB.
- **Durable fix — self-healing table:** added `lib/db/ensure.ts` (`ensureApiKeysTable`,
  idempotent `CREATE TABLE IF NOT EXISTS`, memoized once per cold start) and call it at
  the top of `issueApiKey` / `verifyApiKey` / `listApiKeys`. If an external push drops the
  table, the next API call recreates it — endpoint never stays broken. Verified locally by
  dropping the table and confirming recreate+insert. Chose this over hand-mirroring the
  signup agent's `signups`/`children` in my schema (that risked a push *altering their live
  tables* and would conflict when their feature merges).
- **Kept** `scripts/db-setup.mjs` (manual recreate util); removed throwaway introspection scripts.

### Potential concerns to address:
- **Self-heal recreates the TABLE, not the ROWS.** If another agent's push drops api_keys,
  previously-issued keys are lost (table comes back empty). Acceptable now (no real users),
  but the permanent fix is still: **one shared Drizzle schema on `main` + migrations, and
  NO `drizzle-kit push` against the shared Neon DB.** Other agents must stop running push.
- **Full schema consolidation deferred** until the signup feature merges to `main` — at
  that point put `signups`/`children`/`api_keys` (+ any Clerk tables) in one `lib/db/schema/`
  dir, one `drizzle.config`, and switch to `db:generate`+migrate.
- **This branch is behind `main`** (which has the Clerk-auth merge + README). Merging this
  commit forward; admin approve/revoke UI still not wired into the Clerk-gated `/admin`.
## Progress Update as of June 15, 2026 — 6:37 PM Pacific

### Summary of changes since last update
First entry for this branch. Implemented the read-only v1 of the **Developer API**
(per `docs/superpowers/specs/2026-06-15-developer-api-design.md`) in an isolated
git worktree, fully self-contained and DB-defensive so it doesn't collide with
the in-flight `/signup` work. Tests, typecheck, and production build all pass;
runtime smoke tests confirm the auth/tier gating and page render.

### Detail of changes made:
- **Branch/isolation:** built on `worktree-developer-api` (worktree at
  `.claude/worktrees/developer-api`), branched off `origin/main`. Cherry-picked the
  design spec onto the branch. **No files shared with the signup agent were edited**
  destructively — only additive new files + additive `.env.example`/`package.json` entries.
- **Deps added:** `drizzle-orm`, `@neondatabase/serverless`, `zod` (runtime);
  `vitest`, `drizzle-kit`, `dotenv` (dev). Scripts: `test`, `test:watch`,
  `db:generate`, `db:push`. `vitest.config.ts` (node env, `@/` alias).
- **Key model:** `lib/api-keys.ts` — pure logic: `generateApiKey` (prefix
  `sk_pixelparents_live_`), `hashApiKey` (sha-256), `parseBearer`, `tierSatisfies`.
  10 unit tests. `lib/validation.ts` — zod `keyRequestSchema`, 6 unit tests. **16 tests pass.**
- **DB layer (lazy, never touches `DATABASE_URL` at import):** `lib/db/index.ts`
  (`getSql`/`getDb`/`hasDatabase`), `lib/db/schema/api-keys.ts` (`api_keys` table)
  + barrel `lib/db/schema/index.ts`, `lib/db/api-keys.ts` (issue/verify/list/approve/revoke),
  `lib/db/aggregates.ts` (`getStats`, `getBreakdowns`, `getInterestsPool` — all guarded by
  `to_regclass`, degrade to zeros + `database:"pending"`, per-breakdown try/catch for column drift).
  `drizzle.config.ts` (schema dir glob → `lib/db/migrations`).
- **Routes:** `POST /api/developers/keys` (self-serve public key, returns raw once,
  best-effort Resend email via REST — no SDK dep), `GET /api/v1/stats` (public),
  `GET /api/v1/me` (public), `GET /api/v1/options` (approved), `GET /api/v1/breakdowns`
  (approved). Shared gate `lib/api/authorize.ts`: 401 / 403 `approval_required` / 503.
  All routes `runtime="nodejs"`, `dynamic="force-dynamic"`.
- **Page:** `app/developers/page.tsx` (black bg, mascot, tiers, endpoints table, example
  payloads) + `app/developers/key-console.tsx` (client form → key, shown once, copy button).
- **`lib/options.ts`:** option taxonomies (affiliations/tech-depth/skillsets/time-commitment/grades)
  — intended shared home with the signup feature.
- **Verification:** `vitest run` 16/16 pass; `next build` compiles + TS clean, all 7 routes
  emitted; smoke tests (no live DB): no-auth→401, key+no-DB→503, bad body→400 w/ field errors,
  `/developers`→200.

### Potential concerns to address:
- **MERGE/RECONCILE with the signup agent is the #1 open item.** Both features need
  the Neon/Drizzle DB layer. This branch created its own `lib/db/index.ts`, schema barrel,
  `lib/options.ts`, `drizzle.config.ts`, and added deps. At merge: unify on the
  `lib/db/schema/` directory + barrel pattern (one file per domain), de-dupe `lib/options.ts`,
  reconcile `package.json`/lockfile, and ensure one drizzle client. The signup agent
  also pivoted admin auth to **Clerk** (`@clerk/nextjs`, `app/(authed)/`, `proxy.ts`) —
  the spec assumed Basic Auth.
- **Admin approve/revoke UI not built here.** `approveApiKey`/`revokeApiKey`/`listApiKeys`
  data ops exist; wiring them into `/admin` was deferred because admin auth is in flux
  (Clerk vs Basic Auth). For now a key can be approved via SQL/`db:studio`. Add the admin
  section at merge time, gated by whatever auth lands.
- **Happy-path (valid key → reads) is unverified locally** — needs a live `DATABASE_URL`
  (Neon) + the `api_keys` table created (`drizzle-kit push`/migration). Run the migration
  and an end-to-end check on a Neon branch / preview deploy before relying on it.
- **No rate limiting** on the public self-serve key (low-risk: aggregate counts only). Noted as future hardening.
- **Migrations not generated** (no `DATABASE_URL` at build time). Run `npm run db:generate`
  (or `db:push`) against Neon to create `api_keys` before first real use.
