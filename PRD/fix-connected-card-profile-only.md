## Progress Update as of June 30, 2026 — 8:14 PM Pacific

### Summary of changes since last update
Compressed the "You're connected with X" card on an accepted community response so it shows a single Profile row instead of the full stack of contact rows (email, phone, LinkedIn, GitHub, Website, Profile). The Profile link already leads to everything the person chose to share, and the raw email/phone are still delivered in the warm-intro email, so nothing is lost.

### Detail of changes made:
- app/(authed)/community/[id]/connected-card.tsx: when a 'profile' method is present, render ONLY that row; fall back to the full method list if there is no shareable profile link. Server-side reveal derivation + the intro email are unchanged.

### Potential concerns to address:
- If a connected member has no profile share link, the card still shows their other revealed methods (fallback) — acceptable and rare.
