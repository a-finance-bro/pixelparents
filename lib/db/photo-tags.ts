import { eq } from "drizzle-orm";
import { getSql, getDb } from "./index";
import { photoTags, type PhotoTagRow } from "./schema/photo-tags";

// Self-healing guard (same rationale as ensureApiKeysTable / ensureAdminsTable):
// the shared Neon DB may be touched by a sibling drizzle-kit push, so create the
// table idempotently on first use.
let ensured: Promise<void> | null = null;
export function ensurePhotoTagsTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await getSql()`
        CREATE TABLE IF NOT EXISTS photo_tags (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at timestamptz NOT NULL DEFAULT now(),
          signup_id uuid NOT NULL,
          photo_pathname text NOT NULL,
          tagged_type text NOT NULL,
          tagged_id uuid NOT NULL,
          tagged_name text NOT NULL,
          created_by text
        )
      `;
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export async function listPhotoTags(): Promise<PhotoTagRow[]> {
  await ensurePhotoTagsTable();
  return getDb().select().from(photoTags);
}

export async function addPhotoTag(input: {
  signupId: string;
  photoPathname: string;
  taggedType: string;
  taggedId: string;
  taggedName: string;
  createdBy: string | null;
}): Promise<PhotoTagRow> {
  await ensurePhotoTagsTable();
  const [row] = await getDb().insert(photoTags).values(input).returning();
  return row;
}

export async function removePhotoTag(id: string): Promise<void> {
  await ensurePhotoTagsTable();
  await getDb().delete(photoTags).where(eq(photoTags.id, id));
}
