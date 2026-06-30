## Progress Update as of June 30, 2026 — 12:59 AM Pacific

### Summary of changes since last update
First commit on this branch. Ported the Founder Festival enrichment ENGINE out of
`apps/founder-festival` and INTO the main pixelparents app under `lib/enrichment/`,
fully **de-scored** (information, not numeric scoring) with **every enricher's
status visible** (incl. "API Key Not Set"), plus a net-new keyless
**personal-website scraper**. Added a storage helper that persists onto the
existing `signups.extra` jsonb (no new columns), a runnable READ-ONLY proof
script, and unit tests. Validated: typecheck, full test suite (242 tests), lint
all green, and a live end-to-end proof run.

### Detail of changes made:
- **`lib/enrichment/types.ts`** — `EnrichmentResult { source, status:
  "ok"|"no_api_key"|"no_data"|"error", note?, facts, citations, raw? }`, the
  `Enricher` interface, `EnrichmentSubject`, `EnricherContext`, and `ok/noData/
  noApiKey/errored` helpers. NO score/points anywhere.
- **`lib/enrichment/http.ts`** — shared best-effort fetch helpers (timeout via
  AbortController, byte-capped text, `fetchJson`, `fmtCount`).
- **`lib/enrichment/identity.ts`** — re-implemented donor identity helpers
  (`extractKnownUrls`, `deriveHandleCandidates`, `nameOverlaps`, `handleFromUrls`,
  `firstLast`). Precision over recall.
- **`lib/enrichment/enrichers/*.ts`** — ALL 28 enrichers, re-implemented cleanly
  (no cross-app imports):
  - Keyless, run for real: `website` (NEW scraper), `github` (uses
    `GITHUB_ADMIN_TOKEN` when set, else unauthenticated), `wikipedia`, `wikidata`,
    `yc`, `hackernews`, `hn-tokenmaxxing`, `npm`, `huggingface`, `crates`,
    `tranco`, `openalex`, `devto`, `stackoverflow`, `sec-edgar` (contact-email UA),
    `neo`.
  - Keyed, return fast `no_api_key` when env key absent: `google-kg`/`youtube`
    (`GOOGLE_API_KEY`), `librariesio` (`LIBRARIESIO_API_KEY`), `kaggle`
    (`KAGGLE_API_TOKEN`), `producthunt` (`PRODUCT_HUNT_TOKEN`), `nfx`
    (`NFX_SIGNAL_TOKEN`), `patents` (`USPTO_API_KEY`), `enrichlayer`
    (`ENRICHLAYER_API_KEY`), `exa-domain` (`EXA_API_KEY`), `brightdata`/
    `crunchbase`/`twitter` (`BRIGHTDATA_API_KEY`; async collections deferred).
- **`lib/enrichment/index.ts`** — the registry + `runEnrichment(subject)`: runs
  every enricher in parallel under a per-enricher timeout, KEEPS every result
  (statuses visible), returns `{ factsBySource, statuses[], citations, results }`.
  No scoring.
- **`lib/enrichment/info-extract.ts`** — ONE Claude pass via the Vercel AI Gateway
  (raw fetch to `ai-gateway.vercel.sh`, mirroring `scripts/build-changelog.mjs`;
  falls back to direct Anthropic). Produces a Zod-validated de-scored info profile
  (identity, neutral bio, expertise tags, "how they can help"). Env read lazily so
  dotenv-loaded keys are picked up. Model call is injectable for tests.
- **`lib/enrichment/subject.ts`** — `runFullEnrichment({name?,linkedinUrl?,
  websiteUrl?,githubUsername?})` = registry → info-extract → `{ info, infoExtracted,
  factsBySource, statuses, citations }`.
- **`lib/db/enrichment.ts`** — `saveEnrichment(signupId, result)` (read-modify-write
  of `signups.extra.enrichment`, self-heals via `ensureFamiliesSchema`) and
  `getEnrichment(signupId)`.
- **`scripts/enrich-one.ts`** — READ-ONLY proof script (run with `npx tsx`); prints
  the info profile, facts by source, and the full status roster. Never writes to
  the DB. Used against a public figure (Linus Torvalds) for the PR proof.
- **Tests** — `registry.test.ts` (status keeping + de-dup + no-score),
  `website.test.ts` (ok/no_data/no-url/error), `info-extract.test.ts` (model
  mapping, prose tolerance, invalid JSON, no-facts short-circuit),
  `lib/db/enrichment.test.ts` (read-modify-write with a mocked db).

### Validation
- `npx tsc --noEmit` — clean.
- `npx vitest run` — 242 tests pass (24 files), incl. 19 new.
- `npx eslint .` — 0 errors.
- Live: `npx tsx scripts/enrich-one.ts --github torvalds --name "Linus Torvalds"
  --website https://github.com/torvalds` — 28 enrichers ran: 6 OK
  (website/github/wikipedia/wikidata/tranco/openalex), 10 No Data, 12 API Key Not
  Set; AI info-extraction produced a clean de-scored profile.

### Potential concerns to address (next PRs / follow-ups)
- Signup LinkedIn-opt-in trigger, background job, profile/directory UI rendering,
  claim/edit/refresh, asks/matching are OUT OF SCOPE here (deliberately).
- The async BrightData collections (LinkedIn/Crunchbase/X) are stubbed-with-status
  (no key in this env). Wiring the trigger→poll→download flow is a follow-up.
- Name-search enrichers (stackoverflow, openalex, wikidata) use precision guards
  (reputation floor, footprint floor, human/P31 gate) to avoid same-name / troll
  false positives; thresholds may need tuning against real OHS-parent data.
- The website scraper is regex-based HTML parsing (no DOM lib) — fine for
  title/meta/headings/socials, but JS-rendered SPAs will yield thin text.
