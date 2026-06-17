"use server";

import { currentUser } from "@clerk/nextjs/server";
import { isAdminEmail } from "@/lib/admin";
import { addPhotoTag, removePhotoTag } from "@/lib/db/photo-tags";

async function callerEmail(): Promise<string | null> {
  const u = await currentUser();
  return u?.primaryEmailAddress?.emailAddress ?? null;
}

export async function addPhotoTagAction(input: {
  signupId: string;
  photoPathname: string;
  taggedType: "parent" | "child";
  taggedId: string;
  taggedName: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const caller = await callerEmail();
  if (!(await isAdminEmail(caller))) return { ok: false, error: "forbidden" };
  if (!input.signupId || !input.photoPathname || !input.taggedId) {
    return { ok: false, error: "missing fields" };
  }
  try {
    const row = await addPhotoTag({ ...input, createdBy: caller });
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("addPhotoTagAction failed:", err);
    return { ok: false, error: "failed" };
  }
}

export async function removePhotoTagAction(id: string): Promise<{ ok: boolean }> {
  const caller = await callerEmail();
  if (!(await isAdminEmail(caller))) return { ok: false };
  if (!id) return { ok: false };
  try {
    await removePhotoTag(id);
    return { ok: true };
  } catch (err) {
    console.error("removePhotoTagAction failed:", err);
    return { ok: false };
  }
}
