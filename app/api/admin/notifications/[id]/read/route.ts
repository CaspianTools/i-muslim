import { NextResponse } from "next/server";
import { requirePermission, badRequest } from "@/lib/admin/api";
import { markNotificationRead } from "@/lib/admin/data/notifications";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("notifications.read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || id.length > 200) return badRequest("Invalid id");

  const ok = await markNotificationRead(id);
  return NextResponse.json({ ok });
}
