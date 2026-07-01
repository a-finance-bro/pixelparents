## Progress Update as of [June 30, 2026 — 8:25 PM Pacific]

### Summary of changes since last update
First commit on `feat/mobile-m2`: a mobile audit (375–430px) of Directory, Events,
and Resources. Most of the heavy lifting (MobileSheet filter pattern on
directory/community/events, the horizontally-scrolling Events month grid, the
single-column card grids, full-width forms) already landed on `main` in the prior
`feat-w4-mobile` pass and is inherited here. This pass closes the two remaining
explicit gaps from the audit brief with responsive-only, mobile-first tweaks; no
logic changes; desktop (md+/sm+) is untouched.

### Detail of changes made:
- **Directory** (`app/(authed)/directory/stat-strip.tsx`): the Families / Parents /
  Kids / Here-to-build stat cards now STACK to a single column on the narrowest
  phones (`grid-cols-1`) and go 2×2 from 420px up (`min-[420px]:grid-cols-2`).
  Previously a hard `grid-cols-2` at all widths. Desktop unchanged (still 2×2).
- **Resources** (`app/(authed)/resources/resources-client.tsx`): the Hot / Top /
  New sort switcher is now a horizontal SCROLL strip on phones
  (`overflow-x-auto` + `shrink-0` buttons, scrollbar hidden) instead of a plain
  non-wrapping row, matching the brief's "chips scroll rather than overflow"
  ask; it reverts to inline `flex-wrap` at `sm`. The topic filter chips were left
  as `flex-wrap` (they wrap cleanly and never clip; a nowrap strip fought the
  nested `<TagList>` wrapper, so wrapping is the correct call there).

### Audit findings — already mobile-safe, no change needed:
- **Directory**: WorldMap is `viewBox` + `w-full`, scales to width with no
  overflow; map/stats section is `lg:grid-cols-[…]` so it's single-column below
  lg; search + filter chips + child-age slider live in the MobileSheet bottom
  sheet behind a "Filters" button; family grid is single-column on phones
  (`maxColsForWidth` clamps to 1 below 560px, and the 1-col "wide" card stacks its
  hero on top below sm).
- **Events**: month grid wrapped in `overflow-x-auto` with a `min-w-[560px]
  sm:min-w-0` track (scrolls on phones, fits at sm+); Calendar/List toggle stays
  inline while place + OHS-calendar filters collapse into the MobileSheet (no
  overflow); "Happening this week" cards are a `min-w-[180px]` scroll strip; the
  New-event form is `w-full` inputs in a `max-w-2xl` column with ≥40px targets;
  the day drawer + event-detail Overlay is `w-full` (full-width) on phones. The
  recent timezone fixes (all-day = UTC calendar day; today/current-month from the
  client's local clock via the mount-effect re-sync) are left fully intact.
- **Resources**: board cards are `sm:grid-cols-2` (single column on phones); the
  board detail, the Add-a-contribution composer (link/file/text kind selector +
  inputs), the create-board form, and the inline edit forms are all `w-full`
  controls in `flex flex-col` columns with ≥40px (`py-2.5`) submit targets.

### Validation:
- `npx tsc --noEmit` clean, `npm run lint` clean, `npm test` = 723/723 passing.
- `next build` NOT run in the worktree: Turbopack rejects the cross-filesystem
  node_modules symlink ("Symlink … points out of the filesystem root"). Same
  known limitation noted in prior mobile entries; the prior pass verified the
  build by copying changed files into the main checkout. These two changes are
  pure Tailwind class edits, so no build-time risk.

### Potential concerns to address:
- `next build` remains unverifiable in-worktree (symlinked node_modules). If a
  build check is required, copy the two changed files into the main checkout and
  run `next build` there.
- The directory `[token]` profile view delegates to the shared `ProfileView`
  component (outside this branch's owned files), so its mobile layout was not
  audited or touched here.
