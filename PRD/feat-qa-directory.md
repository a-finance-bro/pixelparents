## Progress Update as of [June 30, 2026 — 9:55 PM Pacific]

### Summary of changes since last update
First entry for this branch. Fixed 4 verified QA findings on the /directory
surface (map, "represented so far" copy, "Here to build" chip, Connect CTA
privacy leak, world-map tooltip wording, "Kids at OHS" mislabel). Stayed strictly
within the owned files. tsc + eslint clean, `npm test` green (795 tests pass,
+2 new).

### Detail of changes made:
- **Finding 1 (HIGH) — breakdowns now completed-only, matching getStats**
  (`lib/db/aggregates.ts`): `getStats` was already fixed to count only completed
  signups (`extra->>'notified' = 'true'`), but `getBreakdowns` had NO such filter,
  so the world-map pins (`signups_by_state`/`signups_by_country`), the "N
  countries, M US states represented so far" line, and the "Here to build" chip
  (`signups_by_builder_interest`) all counted abandoned draft signups — visibly
  disagreeing with the completed-only Families/Parents/Kids chips on the same
  screen. Fix: factored a `COMPLETED = "(extra->>'notified') = 'true'"` constant +
  a `completedFamily(childTable)` helper (correlated EXISTS subquery), and
  threaded them into EVERY signups/children query in getBreakdowns: state,
  country, ohs_affiliation, technical_depth, time_commitment, skillset (unnest),
  builder_interest, the skillsets_by_tech_depth cross-tab, the grade breakdown
  (scoped to completed families), and top_interests (parent side completed-only,
  child union scoped to completed families). getStats reuses the same constant/
  helper so both share one source of truth; the hot-path tagged-template query
  keeps the identical predicate inline (documented) to stay a static template.
- **Finding 2 (MEDIUM) — Connect composer no longer leaks hidden interests**
  (`components/profile-view.tsx`): `connectTopics` built its chips from `interests`
  UNCONDITIONALLY, even though the profile only DISPLAYS interests when
  `visible.has("interests")`. A member who turned the interests share OFF still had
  those interests exposed as click-to-select composer chips (and in the `?topics=`
  URL). Fix: gate the interests portion behind the same `visible.has("interests")`
  check the display uses (`skillsets` and `enrichment.expertiseTags` were already
  visibility-gated upstream).
- **Finding 3 (MEDIUM) — world-map tooltip relabeled "families" → "members"**
  (`components/world-map.tsx`): markers are `count(*)` over parent signups grouped
  by place, NOT `count(distinct family_id)`, so a two-parent household in one state
  showed as "2 families", double-counting against the distinct-family "Families"
  chip. Relabeled the tooltip and the `aria-label` to "member(s)" (accurate to the
  data) and documented why. Chose relabel over adding distinct-family queries
  because the marker-building lives in `lib/community-map.ts` (not an owned file).
- **Finding 4 (MEDIUM) — stat chip relabeled "Kids at OHS" → "Children"**
  (`app/(authed)/directory/stat-strip.tsx`): `total_children` counts every child of
  a completed family with no grade filter, including siblings explicitly marked
  "Not an OHS child" (which collect a birth year instead of a grade). "Kids at OHS"
  overstated actual OHS enrollment. Relabeled the chip to "Children" (keeps the
  count truthful without changing the `total_children` API semantic used by the
  public OpenAPI contract + the dashboard tile). Chose relabel over filtering the
  count because narrowing `total_children` would change a documented API field and
  the dashboard tile lives outside the owned files.

### Tests
- `lib/db/aggregates.test.ts`: +2 tests asserting the `COMPLETED` predicate value
  and that `completedFamily()` correlates to the child table's family_id and reuses
  the shared predicate. The no-DB test env can't exercise SQL, so these cover the
  pure factored logic. Existing "pending" degradation tests still pass.

### Potential concerns to address:
- Did NOT run `next build` in the worktree (per directive). tsc + eslint + vitest
  are green; a build was not attempted.
- SQL correctness for the completed-only breakdowns is exercised only against real
  data (the unit tests can't hit a DB). The predicate strings mirror getStats'
  already-shipped fix, and param-numbering is unchanged (COMPLETED adds no params),
  so positional binds are preserved — but a live DB smoke on /directory is the real
  confirmation.
- The dashboard's own "Kids at OHS" tile (`app/(authed)/dashboard/page.tsx`) has the
  same mislabel but is NOT an owned file, so it was left as-is. Worth a follow-up.
- Finding 3's "members" label is a wording fix, not a data fix; if a true distinct-
  family map count is wanted later, add `count(DISTINCT family_id)` breakdown queries
  in `lib/db/aggregates.ts` + plumb through `lib/community-map.ts` (both would need
  owner sign-off since community-map is out of scope here).
