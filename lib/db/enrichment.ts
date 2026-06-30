// Storage helper for enrichment results. Enrichment lives in the existing
// `signups.extra` jsonb under the `enrichment` key — NO new columns, no schema
// drift (mirrors how builderInterest etc. live in extra). Read-modify-write so we
// preserve any other keys already in `extra`.

import { getSql } from "@/lib/db";
import { ensureFamiliesSchema } from "@/lib/db/ensure";
import type { FullEnrichment } from "@/lib/enrichment/subject";

// Persist an enrichment onto a signup's extra.enrichment. Read-modify-write: we
// fetch the current `extra`, merge in `enrichment`, and write it back so other
// keys (builderInterest, etc.) survive. Returns true when a row was updated.
export async function saveEnrichment(
  signupId: string,
  enrichment: FullEnrichment,
): Promise<boolean> {
  // Self-heal the signups schema (the `extra` column + table) before touching it.
  await ensureFamiliesSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT extra FROM signups WHERE id = ${signupId} LIMIT 1
  `) as Array<{ extra: Record<string, unknown> | null }>;
  if (rows.length === 0) return false;

  const extra = { ...(rows[0]?.extra ?? {}), enrichment };
  const updated = (await sql`
    UPDATE signups SET extra = ${JSON.stringify(extra)}::jsonb WHERE id = ${signupId}
    RETURNING id
  `) as Array<{ id: string }>;
  return updated.length > 0;
}

// Read back a stored enrichment, or null if the signup / key is absent.
export async function getEnrichment(signupId: string): Promise<FullEnrichment | null> {
  await ensureFamiliesSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT extra->'enrichment' AS enrichment FROM signups WHERE id = ${signupId} LIMIT 1
  `) as Array<{ enrichment: FullEnrichment | null }>;
  return rows[0]?.enrichment ?? null;
}
