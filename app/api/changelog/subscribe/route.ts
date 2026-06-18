import { NextResponse } from "next/server";
import { subscribeEmail } from "@/lib/changelog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const ok = await subscribeEmail(email);
  if (!ok) {
    return NextResponse.json({ error: "could not subscribe" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
