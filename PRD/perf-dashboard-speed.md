# Pixel Parents — Progress Log (branch: `perf/dashboard-speed`)
*(Most recent updates at top)*

## Progress Update as of June 30, 2026 — 1:30 AM Pacific

### Summary of changes since last update
Speeds up the authed pages (dashboard/directory/community) by collapsing the
per-cold-start schema self-heal and the stats counts from many sequential Neon
HTTP round-trips into single batched round-trips. Also applies the requested
home-footer copy change.

### Detail of changes made:
- **lib/db/ensure.ts** — `ensureFamiliesSchema` (5 DDL) and `ensureApiKeysTable`
  (~11 DDL) now run their idempotent DDL in ONE `sql.transaction([...])` round-trip
  instead of N sequential awaits. Measured: families self-heal ~750ms → ~390ms;
  api-keys similar. This runs on the dashboard hot path (getSignupByEmail →
  ensureFamiliesSchema) on every cold start, so it's a direct dashboard speedup.
- **lib/db/aggregates.ts** — `getStats` gains a fast UNFILTERED path: all three
  counts (signups / distinct families / children) in ONE combined query instead of
  ~5 round-trips (2× tableExists + 3 counts). Falls through to the existing robust
  path on any error, so filtered/API/K_ANON behavior is unchanged.
- **app/page.tsx** — footer copy: the students clause now reads "and N OHS
  student(s)" (singular "student" at 1, "students" when >1), and the links are
  reordered to "Learn more about us." then "Become a student builder."
- Gates: tsc clean, eslint clean, vitest 176/176. Batching + combined-count
  verified against the live DB.

### Potential concerns to address:
- The self-heal DDL is now needed only as a drift safety net (columns already
  exist in prod). Could be removed from the hot read path entirely later, but the
  batched form is cheap enough to keep as a guard.
- Remaining cold-start cost is Clerk currentUser() + Neon connection warmup; the
  big win here is removing ~6+ serial DB round-trips.
