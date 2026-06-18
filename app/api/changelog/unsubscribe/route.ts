import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db";
import { changelogSubscribers } from "@/lib/db/schema/changelog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click unsubscribe (linked per-recipient from every changelog email).
export async function GET(request: Request) {
  const email =
    new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (hasDatabase() && /^\S+@\S+\.\S+$/.test(email)) {
    try {
      await getDb()
        .update(changelogSubscribers)
        .set({ unsubscribedAt: new Date() })
        .where(eq(changelogSubscribers.email, email));
    } catch (err) {
      console.error("unsubscribe failed:", err);
    }
  }
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed — Pixel Parents</title>` +
      `<body style="background:#000;color:#fff;font-family:system-ui;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center">` +
      `<div><h1 style="font-weight:600">You're unsubscribed</h1>` +
      `<p style="color:#9ca3af">You won't receive any more Pixel Parents changelog emails.</p>` +
      `<p><a style="color:#fbbf24" href="/changelog">Back to the changelog</a></p></div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
