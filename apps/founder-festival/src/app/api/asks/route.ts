import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { asks } from "@/db/schema";
import { isConnectMode } from "@/lib/config/connect-mode";
import { getClaimedUserByClerkId } from "@/lib/asks";
import {
  validateAskTitle,
  validateAskBody,
  validateAskTags,
} from "@/lib/ask-validate";
import { checkAndIncrementRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

// POST /api/asks — a claimed member posts an "ask". Connect-mode only. Anyone
// who has claimed a profile may post (students included — they're the primary
// askers). Rate-limited per IP to curb spam.
export async function POST(req: Request) {
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

  let body: { title?: unknown; body?: unknown; expertiseTags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const titleCheck = validateAskTitle(body.title);
  if (!titleCheck.ok) {
    return NextResponse.json({ error: titleCheck.error, field: "title" }, { status: 400 });
  }
  const bodyCheck = validateAskBody(body.body);
  if (!bodyCheck.ok) {
    return NextResponse.json({ error: bodyCheck.error, field: "body" }, { status: 400 });
  }
  const tagsCheck = validateAskTags(body.expertiseTags);
  if (!tagsCheck.ok) {
    return NextResponse.json({ error: tagsCheck.error, field: "expertiseTags" }, { status: 400 });
  }

  // Spam guard: cap asks created per IP per day. Reuses the app limiter.
  const ip = getRequestIp(req.headers);
  const underLimit = await checkAndIncrementRateLimit(`asks-create:${ip}`, 20);
  if (!underLimit) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const [row] = await db
    .insert(asks)
    .values({
      authorEvaluationId: claimed.evaluationId,
      authorClerkUserId: userId,
      title: titleCheck.value,
      body: bodyCheck.value,
      expertiseTags: tagsCheck.value,
    })
    .returning({ id: asks.id });

  return NextResponse.json({ ok: true, id: row!.id });
}
