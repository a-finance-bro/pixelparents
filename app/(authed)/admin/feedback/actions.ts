"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { isFeedbackStatus, setFeedbackStatus } from "@/lib/db/feedback";

async function requireAdmin(): Promise<void> {
  const u = await currentUser();
  const email = u?.primaryEmailAddress?.emailAddress ?? undefined;
  if (!(await isAdminEmail(email))) throw new Error("Not authorized");
}

// Move a feedback row to a new triage status (reviewed / resolved / back to new).
// Driven by the per-row form's hidden `status` field on the admin page.
export async function updateFeedbackStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !isFeedbackStatus(status)) return;
  await setFeedbackStatus(id, status);
  revalidatePath("/admin/feedback");
}
