# PRD — sparkle/agent-d2dbe859-dd10-4527-88fd-c85b0e1b1701

## Progress Update as of June 28, 2026 — 1:34 PM Pacific

### Summary of changes since last update
Added hover-revealed, click-to-copy anchor links to every section header on
`/builders`. Hovering a heading reveals a small link icon; clicking it copies a
direct URL to that section to the clipboard and smooth-scrolls there.

### Detail of changes made:
- `app/builders/markdown.tsx`: introduced an `AnchorHeading` component used by the
  `h1` and `h2` renderers. It derives a GitHub-style slug from the heading text
  (`slugify` + `textOf` helper that flattens react-markdown children), sets it as
  the element `id`, and adds `scroll-mt-24` for scroll offset.
- The anchor link is a `<button>` (link icon SVG) hidden by default and revealed
  via Tailwind `group-hover:opacity-100` (also on focus for keyboard users).
- Click handler copies `origin+pathname+#slug` via `navigator.clipboard`, updates
  the address bar with `history.replaceState`, smooth-scrolls to the section, and
  shows a transient "Copied!" label for 1.5s.
- Verified: `tsc --noEmit` clean, `eslint app/builders/markdown.tsx` clean, and a
  dev-server curl confirms all three headings render slug `id`s + copy buttons
  (`pixel-parent-builder-guidelines`, `how-to-get-involved-as-a-pixel-parent-builder`,
  `frequently-asked-questions`).

### Potential concerns to address:
- Visual hover behavior was not screenshotted (Claude browser extension not
  connected this session); relied on standard Tailwind `group-hover` + functional
  curl check. Worth an eyeball on the deployed preview.
- Slugs are derived from heading text, so renaming a section in `builders.md`
  changes its anchor URL — acceptable for an internal guidelines page.
