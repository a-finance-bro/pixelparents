## Progress Update as of June 30, 2026 — 9:47 PM Pacific

### Summary of changes since last update
Replaced the confusing "your event may have posted — check Events" wording with definite outcomes. Hardened createEventAction + updateEventAction with a whole-body try/catch so predictable failures ALWAYS return a definite {ok:false} (never throw to the client). A client-side throw now means only a genuine transport failure — and instead of guessing, the forms take the user where the truth is self-evident.

### Detail of changes made:
- lib events actions: whole-body try/catch on create + update.
- event-form.tsx: on a thrown submit, router.push('/events') + refresh (they SEE their event) instead of the "may have been posted" notice; removed the notice + the now-unused Link import + threwWhileSubmitting state.
- community/new/post-form.tsx + resources/new/new-board-form.tsx: on throw, navigate to /community and /resources (+refresh) so the user sees whether it posted.
- offer-help-form, response-thread, board-client (in-place forms): reworded from "may have been X / has been refreshed" to an honest "connection dropped before we could confirm — reload to see the latest, then try again if it isn't there."

### Potential concerns to address:
- QA sweep returned 60 confirmed user-facing issues (separate) — next up.
