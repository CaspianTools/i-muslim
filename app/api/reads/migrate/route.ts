import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { mergeReadsFromLocal } from "@/lib/reads/data";
import { parseReadId } from "@/lib/reads/ids";
import type { SerializedReadMark } from "@/types/reads";

export const runtime = "nodejs";

interface MigratePayload {
  items: Array<{ readId: string; readAt: string }>;
}

function parseBody(raw: unknown): SerializedReadMark[] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MigratePayload>;
  if (!Array.isArray(r.items)) return null;
  const out: SerializedReadMark[] = [];
  for (const entry of r.items) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as { readId?: unknown }).readId !== "string" ||
      typeof (entry as { readAt?: unknown }).readAt !== "string"
    ) {
      continue;
    }
    const mark = parseReadId((entry as { readId: string }).readId);
    if (!mark) continue;
    out.push({
      readId: (entry as { readId: string }).readId,
      mark,
      readAt: (entry as { readAt: string }).readAt,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const auth = getAdminAuth();
  const db = getDb();
  if (!auth || !db) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let decoded;
  try {
    decoded = await auth.verifySessionCookie(token, true);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const items = parseBody(raw);
  if (!items) {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  try {
    const result = await mergeReadsFromLocal(decoded.uid, items);
    return NextResponse.json({ ok: true, added: result.added });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Merge failed";
    console.warn("[reads/migrate] failed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
