import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { asks, askResponses } from "@/db/schema";
import { isConnectMode } from "@/lib/config/connect-mode";
import { getClaimedUserByClerkId } from "@/lib/asks";
import { isHelperType } from "@/lib/member-type";
import { validateAskOffer, validateProposal } from "@/lib/ask-validate";
import { checkAndIncrementRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

// POST /api/asks/[id]/respond — a HELPER offers to help on an open ask. Connect-
// mode only. Must be a claimed non-student profile; can't respond to your own
// ask; one offer per helper per ask (enforced by the unique index + a guard).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  // Students seek; they don't offer help.
  if (!isHelperType(claimed.memberType)) {
    return NextResponse.json({ error: "students_cannot_help" }, { status: 403 });
  }

  const { id: askId } = await ctx.params;

  let body: { offer?: unknown; proposes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const offerCheck = validateAskOffer(body.offer);
  if (!offerCheck.ok) {
    return NextResponse.json({ error: offerCheck.error, field: "offer" }, { status: 400 });
  }
  const proposalCheck = validateProposal(body.proposes);
  if (!proposalCheck.ok) {
    return NextResponse.json({ error: proposalCheck.error, field: "proposes" }, { status: 400 });
  }

  // The ask must exist and be open.
  const [ask] = await db
    .select({ id: asks.id, status: asks.status, authorEvaluationId: asks.authorEvaluationId })
    .from(asks)
    .where(eq(asks.id, askId))
    .limit(1);
  if (!ask) {
    return NextResponse.json({ error: "ask_not_found" }, { status: 404 });
  }
  if (ask.status !== "open") {
    return NextResponse.json({ error: "ask_not_open" }, { status: 409 });
  }
  if (ask.authorEvaluationId === claimed.evaluationId) {
    return NextResponse.json({ error: "cannot_respond_own_ask" }, { status: 403 });
  }

  // One offer per helper per ask.
  const [existing] = await db
    .select({ id: askResponses.id })
    .from(askResponses)
    .where(
      and(
        eq(askResponses.askId, askId),
        eq(askResponses.responderEvaluationId, claimed.evaluationId),
      ),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "already_responded" }, { status: 409 });
  }

  const ip = getRequestIp(req.headers);
  const underLimit = await checkAndIncrementRateLimit(`ask-respond:${ip}`, 40);
  if (!underLimit) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const [row] = await db
    .insert(askResponses)
    .values({
      askId,
      responderEvaluationId: claimed.evaluationId,
      responderClerkUserId: userId,
      offer: offerCheck.value,
      proposes: proposalCheck.value,
    })
    .returning({ id: askResponses.id });

  return NextResponse.json({ ok: true, id: row!.id });
}
