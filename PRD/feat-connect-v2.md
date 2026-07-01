## Progress Update as of [June 30, 2026 — 8:46 PM Pacific]

### Summary of changes since last update
First entry for `feat/connect-v2`. Acts on Daniel's #d5u7YmwJ feedback: make it
obvious how to connect with a specific person from their Directory profile. Adds a
prominent "Connect with <Name>" CTA on the profile, a guided pre-scoped connection
composer (auto @-mention of the target + click-to-select topic chips + minimal-typing
message), reusing the existing Ask post model / `createAskAction` and the existing
`community_mention` notification path (NO new post or notification model). Also
clarifies the enrichment "auto-built + saved" state on the profile.

### Detail of changes made
- **CTA** — `app/(authed)/directory/connect-cta.tsx` (new client component). A
  primary, full-width-on-mobile amber button that links to `/community/new` pre-
  scoped via query params: `connect=<signupId>`, `name=<coarsened display name>`,
  `topics=<comma-joined>`. Rendered from `components/profile-view.tsx` inside
  `nameRow`, directly under the name/location, only when `loggedIn && !isOwner`
  (never on your own profile; signed-out viewers never reach the body — canView
  gate). `connectTopics` = the person's interests + shared skills + shared
  enrichment expertiseTags, deduped case-insensitively.
- **Guided composer** — `app/(authed)/community/new/page.tsx` now reads
  `searchParams` (a Promise in this Next) and calls `resolveConnectTarget()`, which
  RE-AUTHORIZES the connect id server-side via `resolveMentionables` (verified,
  mentionable member only) and uses the AUTHORITATIVE coarsened name — a client
  can't forge a target. It passes a `connect` prop to `PostForm` and swaps the
  header copy to "Connect with <Name>".
- `app/(authed)/community/new/connect-compose.ts` (new, pure + unit-tested) holds
  the compose logic: `connectMentionMarker` (the `@[Name](id)` marker that
  attaches + notifies the target through the SAME path a typed @-mention uses),
  `connectInitialTitle`, `connectComposeBody` (leads with the mention, weaves in
  selected topics), `joinTopics`, `toggleTopic` (order-stable, case-insensitive).
- `app/(authed)/community/new/post-form.tsx` — `PostForm` takes an optional
  `connect: ConnectTarget | null`. When set: kind defaults to Ask, title/body
  pre-fill, and the target's topics render as click-to-select chips. Tapping a
  chip toggles it, adds/removes it as an expertise tag, and (while the body is
  still auto-managed) regenerates the message. `MentionInput` is remounted via a
  changing `key` while auto-managed so regenerated text shows; once the user edits
  the body by hand (`bodyTouched`) the key freezes and their text is preserved.
  Submit still calls the unchanged `createAskAction`, which notifies the mentioned
  target — post model fully reused.
- **Enrichment feedback** — `components/profile-view.tsx` "Auto-built profile"
  badge now reads as an explicit completion + saved state (tooltip "…Saved.", and
  an "Auto-built · edited" label when `editedByOwner`). See deferrals re: live
  in-progress spinner.
- **Tests** — `connect-compose.test.ts` (11 tests) covers the mention marker,
  title, topic join grammar, body composition (with/without topics), and
  toggle/de-dupe/order-stability. Full suite: 747 passed.

### Validation
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm test` 747 passed.
- `next build` intentionally NOT run in the worktree (per instructions).

### Potential concerns to address
- **CTA visibility vs verification**: the CTA shows for any signed-in non-owner,
  but only VERIFIED families can actually post. A signed-in-but-unverified viewer
  who taps through hits the composer page's existing "Verify to post" prompt (not
  a silent failure), but they still see the CTA. Could tighten to only render for
  verified viewers if we thread a verification flag into ProfileView.
- **Enrichment in-progress state**: enrichment is surfaced in my owned files only
  as READ-ONLY curated display (the run/trigger lives in account/family surfaces I
  don't own), so there's no live job to show a spinner/progress for here. I made
  the completion + saved state explicit instead. A true in-progress spinner would
  need changes in the (non-owned) enrichment-trigger surface — deferred.
- MentionInput remount-on-key: relies on the target's "@Name" staying in the body
  for the marker to persist (same contract as any typed mention). If a user
  deletes the "@Name" text, the target is no longer attached/notified — expected,
  matches the base @-mention behavior.
