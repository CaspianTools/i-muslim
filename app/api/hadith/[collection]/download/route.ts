import {
  getHadithCollection,
  getHadithsByCollection,
} from "@/lib/hadith/db";
import { buildHadithExport } from "@/lib/hadith/export";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ collection: string }> },
) {
  const { collection } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) {
    return new Response("Not found", { status: 404 });
  }

  const hadiths = await getHadithsByCollection(collection);
  const payload = buildHadithExport(meta, hadiths, { kind: "collection" });

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection}.json"`,
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
