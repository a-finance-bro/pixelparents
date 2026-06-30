import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { asks, askResponses } from "@/db/schema";
import { isConnectMode } from "@/lib/config/connect-mode";
import { getClaimedUserByClerkId } from "@/lib/asks";

export const dynamic = "force-dynamic";

// POST /api/asks/[id]/responses/[responseId]/decide — the ASKER accepts or
// declines a helper's offer. Body: { decision: "accept" | "decline" }. Connect-
// mode only. Only the ask's author may decide. Accepting flips the response to
// "accepted" and the ask to "matched" (it stays visible but accepts no new
// offers); on the ask-detail page the asker then sees the helper's profile/intro
// path. Declining just marks that one offer declined.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; responseId: string }> },
) {
  if (!isConnectMode()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const claimed = await getClaimedUserByClerkId(userId);
  if (!claimed) {
    return NextResponse.json({ error: "not_claimed" }, { status: 403 });
  }

  const { id: askId, responseId } = await ctx.params;

  let body: { decision?: unknown };
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.decision !== "accept" && body.decision !== "decline") {
    return NextResponse.json({ error: "decision_invalid" }, { status: 400 });
  }

  const [ask] = await db
    .select({ id: asks.id, authorEvaluationId: asks.authorEvaluationId })
    .from(asks)
    .where(eq(asks.id, askId))
    .limit(1);
  if (!ask) {
    return NextResponse.json({ error: "ask_not_found" }, { status: 404 });
  }
  // Only the asker can accept/decline their ask's responses.
  if (ask.authorEvaluationId !== claimed.evaluationId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [resp] = await db
    .select({ id: askResponses.id, status: askResponses.status })
    .from(askResponses)
    .where(and(eq(askResponses.id, responseId), eq(askResponses.askId, askId)))
    .limit(1);
  if (!resp) {
    return NextResponse.json({ error: "response_not_found" }, { status: 404 });
  }
  if (resp.status !== "offered") {
    return NextResponse.json({ error: "already_decided" }, { status: 409 });
  }

  const nextStatus = body.decision === "accept" ? "accepted" : "declined";
  await db
    .update(askResponses)
    .set({ status: nextStatus, decidedAt: new Date() })
    .where(eq(askResponses.id, responseId));

  // Accepting marks the whole ask matched (no new offers, but existing ones
  // remain visible so the asker can still review/accept more if they reopen).
  if (body.decision === "accept") {
    await db
      .update(asks)
      .set({ status: "matched", updatedAt: new Date() })
      .where(eq(asks.id, askId));
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
