import { NextResponse } from "next/server";
import { getSiteSession } from "@/lib/auth/session";
import { savePushToken, deletePushToken } from "@/lib/push/tokens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSiteSession();
  if (!session) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  let token = "";
  try {
    token = String(((await req.json()) as { token?: string })?.token ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  await savePushToken(session.uid, token);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let token = "";
  try {
    token = String(((await req.json()) as { token?: string })?.token ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (token) await deletePushToken(token);
  return NextResponse.json({ ok: true });
}
