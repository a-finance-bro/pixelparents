# Pixel Parents — Developer API (design spec)

**Date:** 2026-06-15
**Branch:** `main`
**Status:** Approved design, pending implementation plan

## 1. Goal

A public **developer API** for pixelparents.org, with a `/developers` docs page
modeled on festival.so/developers. The API sits on top of the in-flight signup
data set (see `2026-06-15-signup-family-profile-design.md`).

Reconciles the original "require approval for an API key" ask with a self-serve
direction: **getting a key is instant and open; getting _elevated data_ requires
approval.**

Hard constraint inherited from the signup spec's privacy note: **raw PII (names,
emails, phones, children, photos) is never exposed through the API at any tier.**
PII stays behind the existing DROdio-only admin Basic Auth gate.

## 2. Core model: one key, two tiers

| Tier | How you get it | What it can read |
|---|---|---|
| `public` | Self-serve, instant, no approval | Only ultra-abstract aggregates: total signups, total children, last-updated timestamp |
| `approved` | DROdio flips a per-key flag in `/admin` | Adds richer **non-PII** reads: option taxonomies + aggregate count breakdowns |

- No tier ever returns raw PII or individual rows.
- **Write/ingest is deferred** — v1 is read-only. (A future `POST /api/v1/signups`
  for approved keys is anticipated but explicitly out of scope here.)

## 3. Endpoints

Auth: `Authorization: Bearer sk_pixelparents_live_…` on every `/api/v1/*` call.
Missing/unknown/revoked key → `401`. Calling an `approved`-tier endpoint with a
`public` key → `403 { error: "approval_required" }`.

| Method | Path | Returns | Tier |
|---|---|---|---|
| GET | `/api/v1/stats` | `{ total_signups, total_children, updated_at, database }` | **public** |
| GET | `/api/v1/me` | `{ tier, label, created_at, approved_at }` — lets a dev check if they've been approved | **public** |
| GET | `/api/v1/options` | Option taxonomies: affiliations, tech-depth, skillsets, time-commitment, grades, interests pool (all non-PII) | **approved** |
| GET | `/api/v1/breakdowns` | Aggregate **counts** by dimension — signups by state / affiliation / tech-depth / skillset; children by grade; top interests. Counts only, zero rows | **approved** |

Plus a key-issuance route (developer-facing, not `/api/v1` data):

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/developers/keys` | Body `{ name, email, intended_use, label? }` → mints a `public`-tier key, returns the raw key **exactly once**, emails DROdio the new request (best-effort) so he can choose to approve it. |

### `/api/v1/stats` example response
```json
{
  "total_signups": 42,
  "total_children": 37,
  "updated_at": "2026-06-15T18:30:00.000Z",
  "database": "ready"
}
```
`database` is `"pending"` (and counts are `0`) until the signup tables exist.

### `/api/v1/breakdowns` example response (approved tier)
```json
{
  "signups_by_state": { "CA": 18, "WA": 6, "NY": 4 },
  "signups_by_affiliation": { "Existing parent (currently enrolled)": 22, "New parent (child(ren) just starting at OHS)": 12 },
  "signups_by_tech_depth": { "10x Developer": 9, "Vibe coder": 7 },
  "signups_by_skillset": { "Frontend": 14, "Backend": 11, "AI LLM Wrangler": 8 },
  "children_by_grade": { "9th": 11, "10th": 9, "11th": 8 },
  "top_interests": [ { "interest": "robotics", "count": 12 }, { "interest": "music", "count": 9 } ],
  "updated_at": "2026-06-15T18:30:00.000Z"
}
```

## 4. Data model — new `api_keys` table

Lives in its own schema file (`lib/db/schema/api-keys.ts`) to avoid colliding
with the signup agent's schema work.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `created_at` | timestamptz | `now()` |
| `key_hash` | text unique | SHA-256 of the raw key (only the hash is stored) |
| `key_prefix` | text | display prefix, e.g. `sk_pixelparents_live_ab12` |
| `label` | text | optional, dev-supplied |
| `name` | text | requester name |
| `email` | text | requester email (so DROdio can contact / approve) |
| `intended_use` | text | what they're building |
| `tier` | text | `public` \| `approved`, default `public` |
| `approved_at` | timestamptz | nullable; set when DROdio approves |
| `revoked_at` | timestamptz | nullable; set when revoked |
| `last_used_at` | timestamptz | nullable; best-effort touch on each verified call |

## 5. Key mechanics (`lib/api-keys.ts`)

Mirrors the festival pattern:
- `generateApiKey()` → `{ raw, hash, prefix }`. `KEY_PREFIX = "sk_pixelparents_live_"`;
  secret = `randomBytes(24).toString("base64url")`; prefix = brand + first 4 chars.
- `hashApiKey(raw)` → SHA-256 hex.
- `parseBearer(header)` → token or null.
- `verifyApiKey(authHeader)` → `{ keyId, tier } | null`; updates `last_used_at`
  best-effort (a write failure there must never fail an otherwise-valid request).
- Raw key is shown to the requester exactly once at issuance; we store only the hash.

## 6. The `/developers` page (`app/developers/page.tsx`)

Pixel Parents look-and-feel (black background, pixel mascot logo), structured
like festival.so/developers:

1. **Header** — mascot logo (links home) + title ("Build with the Pixel Parents
   API") + a one-line privacy promise: *"Never returns names, emails, phones,
   children, or photos — only counts and taxonomies."*
2. **Tiers** — side-by-side: *Public — free & instant* vs *Approved — request
   access* (what each unlocks).
3. **Endpoints** — the reference table from §3 (method / path / description / tier).
4. **Example responses** — the `/stats` and `/breakdowns` payloads from §3.
5. **Get a key** — a small open form (name / email / what you're building) that
   calls `POST /api/developers/keys` and shows the returned Tier-1 key **once**,
   with a note that elevated access is granted by approval. No login system
   needed (unlike festival's Clerk-gated console) because Tier 1 is self-serve.

Page is `force-dynamic` and `metadata` set for title/description.

## 7. Admin integration (`/admin`)

The signup spec already builds a DROdio-only `/admin` behind `middleware.ts`
Basic Auth. This feature **adds a small "API keys" section** there:
- List keys newest-first: prefix, name, email, intended_use, tier, created/last-used.
- Action to **approve** (set `tier='approved'`, `approved_at=now()`) and **revoke**
  (`revoked_at=now()`). Implemented as server actions on the already-gated page,
  reusing the same Basic Auth — no new auth surface.

## 8. Coordination with the in-flight signup work ⚠️

A second agent is concurrently building `/signup` (Neon Postgres + Drizzle +
Zod). To avoid file collisions and a hard build dependency:

- **Own (new files only):** `lib/db/schema/api-keys.ts`, `lib/api-keys.ts`,
  `app/api/v1/stats/route.ts`, `app/api/v1/me/route.ts`,
  `app/api/v1/options/route.ts`, `app/api/v1/breakdowns/route.ts`,
  `app/api/developers/keys/route.ts`, `app/developers/page.tsx`, the key console
  client component, and the `/admin` API-keys section.
- **Share:** the Drizzle/Neon client (`lib/db`), `DATABASE_URL`, and
  `lib/options.ts` (taxonomies). Import them; if a shared file doesn't exist yet,
  create a minimal version and flag it in the plan for reconciliation with the
  signup agent's version. Prefer a `lib/db/schema/` directory with one file per
  domain + a barrel `index.ts`, and a drizzle-kit `schema` glob, so both agents'
  tables compose without editing the same file.
- **Defensive queries:** aggregate endpoints guard on table existence
  (`SELECT to_regclass('public.signups')`); if absent, return zeroed counts +
  `database: "pending"` (200, not 500) so the API ships before signup tables land.
- **Email reuse:** the key-request notification reuses the signup feature's
  Resend setup (`lib/email.ts`, `RESEND_*`, `NOTIFY_TO`) if present; otherwise a
  thin best-effort wrapper, never blocking key issuance.

## 9. Environment variables

No *new* required vars beyond what the signup feature introduces
(`DATABASE_URL`, and `RESEND_API_KEY` / `RESEND_FROM` / `NOTIFY_TO` for the
best-effort request email). All secrets stay in git-ignored `.env.local` +
Vercel env; templates in `.env.example`. The pre-commit secret guard covers them.

## 10. Validation & error handling

- `POST /api/developers/keys`: zod-validate `{ name, email, intended_use }`
  (email format; trim/length-cap label and free text). Reject malformed bodies
  `400`. Email notification is best-effort (try/catch) and never blocks issuance.
- All `/api/v1/*`: `401` on missing/unknown/revoked key, `403
  approval_required` when a `public` key hits an `approved` endpoint, `200`
  otherwise (including the `database: "pending"` degraded shape).
- No raw rows ever returned; breakdowns are `GROUP BY … COUNT(*)` only.

## 11. Testing

- **Unit (Vitest):** `generateApiKey`/`hashApiKey`/`parseBearer` round-trips;
  tier gating logic (public vs approved); request-body zod accept/reject; the
  `to_regclass` "pending" fallback branch. Pure logic, no live DB.
- **Integration:** exercise issuance → verify → tier upgrade → approved read
  manually against a Neon branch / preview deploy; document the happy-path
  checklist in the plan.

## 12. Out of scope (now)

- Write/ingest endpoint (`POST /api/v1/signups`).
- Any raw-PII read at any tier.
- Per-key rate limiting / abuse quotas (data is low-risk aggregate counts;
  noted as a future hardening item).
- A developer login/console account system, billing, or paid credits.
- Public, authenticated OHS-family viewing of signup answers (also out of scope
  in the signup spec).
