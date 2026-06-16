"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { signups } from "@/lib/db/schema/signups";
import { isAdminEmail } from "@/lib/admin";
import { signupSchema, linkedinUrlFromHandle } from "@/lib/validation";

export type EditState = { ok: boolean; errors?: Record<string, string>; message?: string };

export async function updateSignup(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const u = await currentUser();
  const caller = u?.primaryEmailAddress?.emailAddress;
  if (!(await isAdminEmail(caller))) {
    return { ok: false, message: "Forbidden — not an admin." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing record id." };

  const parsed = signupSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    githubUsername: formData.get("githubUsername") ?? "",
    ohsAffiliation: formData.get("ohsAffiliation") ?? "",
    technicalDepth: formData.get("technicalDepth") ?? "",
    linkedinHandle: formData.get("linkedinHandle") ?? "",
    skillsets: formData.getAll("skillsets"),
    timeCommitment: formData.get("timeCommitment") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  const d = parsed.data;

  try {
    await getDb()
      .update(signups)
      .set({
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
        githubUsername: d.githubUsername,
        ohsAffiliation: d.ohsAffiliation || null,
        technicalDepth: d.technicalDepth || null,
        linkedinUrl: linkedinUrlFromHandle(d.linkedinHandle),
        skillsets: d.skillsets?.length ? d.skillsets : null,
        timeCommitment: d.timeCommitment || null,
        city: (String(formData.get("city") ?? "").trim()) || null,
        state: (String(formData.get("state") ?? "").trim()) || null,
      })
      .where(eq(signups.id, id));
  } catch (err) {
    console.error("updateSignup failed:", err);
    return { ok: false, message: "Save failed. Please try again." };
  }

  redirect("/admin");
}
