import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isConnectMode } from "@/lib/config/connect-mode";
import { isMemberType } from "@/lib/member-type";

export const dynamic = "force-dynamic";

// POST /api/account/member-type — the signed-in user sets their OHS member type
// (student | parent | alumni | community) for the connect-mode asks connector.
// Only active when CONNECT_MODE is on; otherwise 404 so the festival.so product
// is unaffected.
export async function POST(req: Request) {
  if (!isConnectMode()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { memberType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isMemberType(body.memberType)) {
    return NextResponse.json(
      { error: "member_type_invalid", field: "memberType" },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ memberType: body.memberType })
    .where(eq(users.clerkUserId, userId));

  return NextResponse.json({ ok: true, memberType: body.memberType });
}
