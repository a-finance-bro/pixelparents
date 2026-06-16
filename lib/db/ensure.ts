import { getSql } from "./index";

// Self-healing guard for the api_keys table.
//
// This app shares one Neon database with other features (signup, etc.). Until
// every feature is consolidated onto a single Drizzle schema + migration flow,
// another feature running `drizzle-kit push` from its own partial schema will
// see api_keys as an orphan and DROP it. Rather than let the API break until a
// human re-runs a migration, we ensure the table exists (idempotently) on the
// first key operation per cold start. Worst case after an external drop is the
// loss of previously-issued key rows — the endpoint itself never stays broken.
//
// The CREATE statement mirrors lib/db/schema/api-keys.ts exactly.

let ensured: Promise<void> | null = null;

export function ensureApiKeysTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await getSql()`
        CREATE TABLE IF NOT EXISTS api_keys (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at timestamptz NOT NULL DEFAULT now(),
          key_hash text NOT NULL UNIQUE,
          key_prefix text NOT NULL,
          label text,
          name text NOT NULL,
          email text NOT NULL,
          intended_use text NOT NULL,
          tier text NOT NULL DEFAULT 'public',
          approved_at timestamptz,
          revoked_at timestamptz,
          last_used_at timestamptz
        )
      `;
    })().catch((e) => {
      // Reset so a transient failure (e.g. a concurrent CREATE race) retries on
      // the next call rather than caching the rejection forever.
      ensured = null;
      throw e;
    });
  }
  return ensured;
}
