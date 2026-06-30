import { getSql } from "./db";
import { ensureFamiliesSchema } from "./db/ensure";

// ── Auto-link families by shared OHS student email (flagged) ─────────────────
//
// When a parent verifies their OHS student's stanford.edu email, ANOTHER family
// may already be associated with that exact student (e.g. a father signed up as
// one family, the son/other parent as a second, and one of them verified the
// student email earlier). This module MERGES those families into one so the OHS
// student maps to a single canonical family.
//
// Everything here is gated by the FAMILY_AUTOLINK_ENABLED flag at the call site
// (confirmStudentCode); this module is pure plumbing and never reads the flag.
//
// Design rules (all enforced below):
//   - Find OTHER families (family_id <> the verifier's) already carrying `email`,
//     across three sources, all compared lowercased:
//       1. signups.extra->>'verifiedStudentEmail'   (legacy singular)
//       2. signups.extra->'verifiedStudentEmails'   (jsonb array, @> match)
//       3. children.student_email                    (stamped on verify)
//   - None found → no-op (idempotent, self-match-safe).
//   - Canonical = the OLDEST family (min families.created_at; tie-break by id) of
//     {verifier} ∪ {matches}. Repoint the OTHER families' signups.family_id +
//     children.family_id to the canonical id. We do NOT delete the now-orphaned
//     families rows (soft orphan) and we do NOT auto-dedupe children.
//   - Family-wide approve the canonical for `email` (mirrors confirmStudentCode's
//     approve UPDATE) keeping the `<> 'denied'` guard.
//   - Append an audit entry per merged family to canonical extra.merges:
//       { from: <orphanedFamilyId>, email, at: <ISO> }
//   - Deterministic + race-safe: re-running with the same inputs converges (the
//     repoint WHERE family_id = ANY(orphans) becomes a 0-row update once moved;
//     the canonical pick is stable because it's the min created_at/id).

// A family row as far as the canonical decision is concerned.
export type FamilyAge = { id: string; createdAt: Date | string };

// Pure: pick the canonical (surviving) family from a set — the oldest by
// created_at, tie-broken by the smaller id (lexicographic) so the choice is
// deterministic regardless of input order or equal timestamps. Returns null for
// an empty set. Exported for unit tests.
export function pickCanonicalFamily(families: FamilyAge[]): FamilyAge | null {
  if (families.length === 0) return null;
  return families.reduce((best, f) => {
    const bt = new Date(best.createdAt).getTime();
    const ft = new Date(f.createdAt).getTime();
    if (ft < bt) return f;
    if (ft > bt) return best;
    // Same timestamp → smaller id wins (deterministic tie-break).
    return f.id < best.id ? f : best;
  });
}

// Pure: given the canonical family id and the full candidate set, the families
// that must be repointed are everyone EXCEPT the canonical. Deduped + sorted for
// determinism. Exported for unit tests.
export function familiesToRepoint(canonicalId: string, allIds: string[]): string[] {
  return Array.from(new Set(allIds))
    .filter((id) => id !== canonicalId)
    .sort();
}

// Pure: normalize an email the same way the verify flow does — trim + lowercase.
// Re-implemented here (rather than importing normalizeEmail) so this module's
// comparison contract is self-contained and unit-testable in isolation.
export function lowerEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Result shape (mostly for tests / logging; the call site ignores it).
export type MergeResult =
  | { merged: false; reason: "no-email" | "no-match" }
  | { merged: true; canonicalFamilyId: string; mergedFamilyIds: string[] };

// Find OTHER families already carrying `email`, merge them into the oldest
// (canonical) family, repoint their signups + children, family-wide approve the
// canonical for the email, and append an audit trail. Idempotent + self-safe.
//
// `verifierFamilyId` is the family of the parent who just verified; `email` is
// the student email they verified. No-op if no OTHER family has the email.
export async function mergeFamiliesByVerifiedEmail(
  verifierFamilyId: string,
  email: string,
): Promise<MergeResult> {
  const normalized = lowerEmail(email);
  if (!normalized) return { merged: false, reason: "no-email" };

  await ensureFamiliesSchema();
  const sql = getSql();

  // 1) Collect every family_id (other than the verifier's) that already carries
  //    this email, across all three sources. All comparisons are lowercased.
  //    `@>` containment needs a lowercased array; we can't lowercase inside a
  //    jsonb array cheaply in SQL, so we expand the array to text rows and
  //    lower() each element for the array source.
  const matchRows = (await sql`
    SELECT DISTINCT s.family_id AS family_id
    FROM signups s
    WHERE s.family_id IS NOT NULL
      AND s.family_id <> ${verifierFamilyId}
      AND (
        lower(s.extra->>'verifiedStudentEmail') = ${normalized}
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(s.extra->'verifiedStudentEmails') = 'array'
              THEN s.extra->'verifiedStudentEmails' ELSE '[]'::jsonb END
          ) AS e(val)
          WHERE lower(e.val) = ${normalized}
        )
      )
    UNION
    SELECT DISTINCT c.family_id AS family_id
    FROM children c
    WHERE c.family_id IS NOT NULL
      AND c.family_id <> ${verifierFamilyId}
      AND lower(c.student_email) = ${normalized}
  `) as Array<{ family_id: string }>;

  const otherFamilyIds = Array.from(
    new Set(matchRows.map((r) => r.family_id).filter((id): id is string => Boolean(id))),
  );
  if (otherFamilyIds.length === 0) return { merged: false, reason: "no-match" };

  // 2) Pick the canonical (oldest) family among {verifier} ∪ {others}. We read
  //    created_at for the full candidate set so the choice doesn't depend on
  //    which row triggered the merge.
  const candidateIds = Array.from(new Set([verifierFamilyId, ...otherFamilyIds]));
  const ageRows = (await sql`
    SELECT id::text AS id, created_at AS created_at
    FROM families
    WHERE id = ANY(${candidateIds}::uuid[])
  `) as Array<{ id: string; created_at: string }>;

  const ages: FamilyAge[] = ageRows.map((r) => ({ id: r.id, createdAt: r.created_at }));
  // Guard: if some candidate family rows are missing (soft-orphaned earlier),
  // still pick among what exists; fall back to the verifier id if needed.
  const canonical = pickCanonicalFamily(ages);
  const canonicalId = canonical?.id ?? verifierFamilyId;

  const repointIds = familiesToRepoint(canonicalId, candidateIds);
  if (repointIds.length === 0) return { merged: false, reason: "no-match" };

  const at = new Date().toISOString();
  // One audit entry per merged (orphaned) family.
  const auditEntries = repointIds.map((from) => ({ from, email: normalized, at }));

  // 3) All writes in ONE transaction when the driver supports it (neon-http
  //    sql.transaction takes an array of statements — no interleaved reads —
  //    which is exactly our shape). Repoint signups + children, family-wide
  //    approve the canonical for the email, and append the audit trail.
  const statements = [
    // Repoint the orphaned families' parents to the canonical family.
    sql`
      UPDATE signups
      SET family_id = ${canonicalId}::uuid
      WHERE family_id = ANY(${repointIds}::uuid[])
    `,
    // Repoint the orphaned families' children to the canonical family.
    sql`
      UPDATE children
      SET family_id = ${canonicalId}::uuid
      WHERE family_id = ANY(${repointIds}::uuid[])
    `,
    // Family-wide approve the canonical for the email (mirrors confirmStudentCode
    // exactly: approve every non-denied parent now sharing the canonical family,
    // record the verified email on both the singular + plural fields, dedup the
    // array). Now that signups were repointed, family_id = canonical also covers
    // the just-merged parents. Approval attribution is only stamped where not yet
    // approved (purely additive, never re-gating).
    sql`
      UPDATE signups
      SET extra = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
            COALESCE(extra, '{}'::jsonb) - 'studentVerify',
            '{approvalStatus}', to_jsonb('approved'::text), true),
            '{approvalBy}',
              CASE WHEN COALESCE(extra->>'approvalStatus', 'pending') = 'approved'
                THEN COALESCE(extra->'approvalBy', to_jsonb('student-email'::text))
                ELSE to_jsonb('student-email'::text) END,
              true),
            '{approvalAt}',
              CASE WHEN COALESCE(extra->>'approvalStatus', 'pending') = 'approved'
                THEN COALESCE(extra->'approvalAt', to_jsonb(${at}::text))
                ELSE to_jsonb(${at}::text) END,
              true),
            '{verifiedStudentEmail}', to_jsonb(${normalized}::text), true),
            '{verifiedStudentEmails}',
              CASE
                WHEN COALESCE(
                       extra->'verifiedStudentEmails',
                       CASE WHEN jsonb_typeof(extra->'verifiedStudentEmail') = 'string'
                         THEN jsonb_build_array(extra->'verifiedStudentEmail')
                         ELSE '[]'::jsonb END
                     ) @> to_jsonb(${normalized}::text)
                  THEN COALESCE(
                       extra->'verifiedStudentEmails',
                       CASE WHEN jsonb_typeof(extra->'verifiedStudentEmail') = 'string'
                         THEN jsonb_build_array(extra->'verifiedStudentEmail')
                         ELSE '[]'::jsonb END)
                ELSE COALESCE(
                       extra->'verifiedStudentEmails',
                       CASE WHEN jsonb_typeof(extra->'verifiedStudentEmail') = 'string'
                         THEN jsonb_build_array(extra->'verifiedStudentEmail')
                         ELSE '[]'::jsonb END
                     ) || to_jsonb(${normalized}::text)
              END,
              true)
      WHERE family_id = ${canonicalId}::uuid
        AND COALESCE(extra->>'approvalStatus', 'pending') <> 'denied'
    `,
    // Stamp the verified student email onto the canonical family's children that
    // lack one (mirrors confirmStudentCode).
    sql`
      UPDATE children
      SET student_email = ${normalized}
      WHERE family_id = ${canonicalId}::uuid
        AND (student_email IS NULL OR student_email = '')
    `,
    // Append the merge audit trail to the canonical family's NEWEST signup's
    // extra.merges (the family-level audit log). Concatenates onto the existing
    // array (back-filled to [] when absent). Scoped to one row so the array isn't
    // duplicated across every co-parent.
    sql`
      UPDATE signups
      SET extra = jsonb_set(
            COALESCE(extra, '{}'::jsonb),
            '{merges}',
            COALESCE(
              CASE WHEN jsonb_typeof(extra->'merges') = 'array' THEN extra->'merges' ELSE '[]'::jsonb END,
              '[]'::jsonb
            ) || ${JSON.stringify(auditEntries)}::jsonb,
            true)
      WHERE id = (
        SELECT id FROM signups
        WHERE family_id = ${canonicalId}::uuid
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
    `,
  ];

  if (typeof (sql as { transaction?: unknown }).transaction === "function") {
    await (sql as unknown as { transaction: (s: unknown[]) => Promise<unknown> }).transaction(
      statements,
    );
  } else {
    // Driver without transaction support → back-to-back (still idempotent).
    for (const stmt of statements) await stmt;
  }

  return { merged: true, canonicalFamilyId: canonicalId, mergedFamilyIds: repointIds };
}
