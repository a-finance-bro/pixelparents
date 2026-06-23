# feat/builders-opensource-link

## Progress Update as of June 22, 2026 — 5:52 PM Pacific

### Summary of changes since last update
Linked the words "open source" in the `/builders` page footer ("These guidelines live
in builders.md in our open source repo") to the GitHub repository.

### Detail of changes made:
- `app/builders/page.tsx`: wrapped "open source" in the footer paragraph in an
  `<a href="https://github.com/drodio/pixelparents">` styled to match the existing
  emerald link style. Same repo URL already referenced in the `builders.md` body.
- Build verified clean.

### Potential concerns to address:
- None. Pure content/markup change.
