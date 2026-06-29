## Progress Update as of June 28, 2026 — 7:22 PM Pacific

### Summary of changes since last update
First entry for `feat/directory-filters`. Added two new CLIENT-side filters to the
authenticated `/directory` page — a dual-thumb child age-range slider and an opt-in
"near me" location radius filter — on top of the existing search / interest chips /
sort / density controls. No access-control or visibility-gating logic changed; the
new filters operate over the already-redacted `DirectoryCard`s.

### Detail of changes made
- **Age derivation (`lib/directory-filters.ts::childAge`)** — pure, deterministic
  (takes `currentYear`). Prefers `birthYear` (age = currentYear − birthYear, for
  non-OHS kids); otherwise maps an OHS grade to a typical age via grade N → N+5
  (7th≈12 … 12th≈17; kindergarten/"K"≈5). Returns `null` for "Not an OHS child",
  blank, or a future birthYear. `buildDirectoryCard` now takes `currentYear` and
  includes `age: number | null` on each shared child (only when "children" was
  shared — existing redaction untouched). `page.tsx` passes `new Date().getFullYear()`.
- **Distance (`haversineMiles`)** — pure great-circle miles helper.
- **Offline geocoding (`geocodeLocation` + `lib/data/us-geo.ts`)** — NO paid API at
  request time. Static tables: ~115 major-US-city `city,ST` → lat/lng, 50-state +
  DC centroids, and a coarse ZIP-first-digit region centroid table. Resolution
  order: exact city → state centroid → ZIP region. Accepts full state name or USPS
  abbr; case-insensitive city. **This is an approximation by design** — an unknown
  town resolves to its state centroid (right state, wrong town); a typed ZIP only
  resolves to a very coarse region. Documented in the data file header.
- **Module split** — the three pure helpers live in a NEW client-safe
  `lib/directory-filters.ts`; `lib/directory.ts` re-exports them. Reason:
  `lib/directory.ts` transitively imports `node:crypto` (via `lib/share`), so the
  client could not import it at runtime (previously only a type-only import). The
  client imports helpers straight from `lib/directory-filters`.
- **UI (`directory-client.tsx`)**:
  - `DualRange` component: two overlaid native `<input type=range>` (amber thumbs,
    pointer-events toggling so both stay grabbable) over a track with an amber fill.
    Range 1…18 where the top thumb at 18 means "18+". Default both extremes →
    filter INACTIVE. Label: "All ages" / "Ages 6–12" / "Ages 8–18+". A family
    matches if ANY shown child's derived age falls in [lower, upper] (upper=18 → no
    upper bound).
  - Radius filter: a "Near me" checkbox (OFF by default). On activation it requests
    `navigator.geolocation`; the viewer can also type a "City, State or ZIP" origin
    (geocoded with the same static tables). Radius slider steps
    1/5/10/25/50/100/250/500/1000 mi → "Worldwide" (default 10 mi; Worldwide = no
    limit). Families that didn't share location, or whose location can't be
    geocoded, are EXCLUDED while the radius filter is active.
  - All filters combine with AND alongside the existing search/interest/sort.
- **Tests (`lib/directory.test.ts`)** — existing call sites updated for the new
  `currentYear` arg + `age` field; added suites for `childAge`, `haversineMiles`
  (incl. SF→LA ≈347 mi), and `geocodeLocation`. 32 tests pass.

### Verification
- `npx tsc --noEmit` clean; `npx eslint` clean on changed files;
  `npx vitest run lib/directory.test.ts` → 32 passing.
- `npx next build` compiles the directory client bundle successfully (no
  `node:crypto` leak). The build's only failure is the pre-existing intentional
  `/preview/throw` error-boundary demo page — unrelated to this branch.

### Potential concerns to address
- Geocoding is approximate: most families fall back to a state centroid, so radius
  results near a state border or for intra-state distances are rough. If precision
  matters later, bundle a fuller city or ZIP→lat/lng dataset (still offline).
- ZIP origin resolves only to a coarse first-digit region; consider a ZIP3 centroid
  table if users rely on ZIP entry.
- Age mapping assumes the US grade convention; non-OHS kids without a birthYear
  contribute no age and won't match the age filter (by design).
