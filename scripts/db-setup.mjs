// One-off: create the api_keys table (idempotent) and report what's in the DB.
// Surgical CREATE TABLE IF NOT EXISTS — never drops/alters anything else, so it
// is safe to run against a Neon DB the parallel signup feature also uses.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(url);

await sql`
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

const present = async (t) => {
  const r = await sql`SELECT to_regclass(${"public." + t}) IS NOT NULL AS p`;
  return Boolean(r[0]?.p);
};

console.log("api_keys table ready.");
console.log("Tables present:");
for (const t of ["api_keys", "signups", "children"]) {
  console.log(`  ${t.padEnd(10)} ${(await present(t)) ? "yes" : "no"}`);
}
const [{ c }] = await sql`SELECT count(*)::int AS c FROM api_keys`;
console.log(`api_keys row count: ${c}`);
