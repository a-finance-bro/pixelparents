# Pixel Parents — Auto-save signup & edit forms (design spec)

**Date:** 2026-06-17
**Branch:** `worktree-autosave` → PR
**Beads:** `pixelparents-signup-qek`
**Status:** Approved design, implementing

## 1. Goal
On `/signup` (step 1 + step 2) and the edit flows, persist each field change to
the DB automatically (debounced) — no Save/Done click. Buttons only navigate.

## 2. Mechanism — `useAutoSave` hook (`lib/use-auto-save.ts`)
- `useAutoSave(save)` → `{ queue, status, flush }`.
- `queue(patch, immediate?)` merges `patch` into a pending object; debounces
  text (~600ms), flushes immediately for selects/checkboxes (`immediate=true`).
- `status`: `idle | saving | saved | error`. On error the local value is kept so
  the next change retries. Last-write-wins.
- A small `<SaveStatus status={…}/>` indicator (Saving… / Saved / Couldn't save).

## 3. Step 1 (`/signup`) — draft row + navigate
- First input → `createDraftSignup()` (server action): runs `checkBotId()` once,
  inserts a `signups` row with empty-string required fields, returns `{ id }`.
  Held in client state; subsequent changes call `patchSignup(id, patch)`.
- `patchSignup(id, patch)` sanitizes + writes only the provided columns. No bot
  re-check (row already exists).
- Required four (first/last/email/phone) + github validate **inline** (non-blocking
  to saving). The submit becomes **"Continue →"**: client-validates required, then
  `completeSignup(id)` (idempotent notify email via `extra.notified`) and routes to
  `/signup/thanks?id=<id>`.

## 4. Step 2 (`/signup/thanks`) — family fields + live child list
- Family fields (city/state/parentInterests/photos/captions) auto-save via
  `patchSignup`.
- **Children become a live list** (replaces "Done / Done + add another / skip"):
  - **"+ Add child"** → `addChild(signupId)` inserts an empty child row, returns id.
  - Each child card auto-saves via `patchChild(childId, signupId, patch)` (scoped
    by signupId; UUID-guarded).
  - **✕** on a card → `removeChild(childId, signupId)`.
  - The only button is **"Finish →"** linking to `/signup/welcome` (navigation only).

## 5. Edit flows
- Returning-parent editor IS `/signup/thanks` (same `family-form`) → covered by §4.
- Admin edit pages (`/admin/parents/[id]/edit`, `/admin/children/[id]/edit`):
  same hook, patching existing rows; Save buttons removed. **(Fast-follow — may
  land in a second commit/PR; tracked on the same beads issue.)**

## 6. Validation, bots, drafts
- Per-field sanitize server-side (reuse `signupSchema`/`childSchema` field rules
  where practical; patches validate the subset present).
- **BotID once** at draft creation; patches skip it. Abandoned/blank drafts are
  filtered out of `/admin` (e.g. hide rows with empty first+last+email) and can be
  pruned later.
- Required-field errors show inline but never block saving optional fields.

## 7. Testing
- Unit: the patch-merge/debounce logic of `useAutoSave` (pure parts); the
  "blank draft" filter predicate. Manual: type→save→reload shows persistence;
  add/remove child live; Continue routes + notifies once.

## 8. Out of scope
- Offline queue / conflict resolution beyond last-write-wins.
- Realtime multi-tab sync.
