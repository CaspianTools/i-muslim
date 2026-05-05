import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/api";
import { loadPaletteIndex } from "@/lib/admin/search/palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const index = await loadPaletteIndex();
  return NextResponse.json(index);
}
