import {
  getHadithCollection,
  getHadithsByBook,
} from "@/lib/hadith/db";
import { buildHadithExport } from "@/lib/hadith/export";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ collection: string; book: string }> },
) {
  const { collection, book } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) {
    return new Response("Not found", { status: 404 });
  }

  const bookNumber = Number(book);
  if (!Number.isInteger(bookNumber) || bookNumber < 1) {
    return new Response("Not found", { status: 404 });
  }
  const bookMeta = meta.books.find((b) => b.number === bookNumber);
  if (!bookMeta) {
    return new Response("Not found", { status: 404 });
  }

  const hadiths = await getHadithsByBook(collection, bookNumber);
  const payload = buildHadithExport(meta, hadiths, {
    kind: "book",
    book: bookNumber,
    bookName: bookMeta.name,
    count: bookMeta.count,
  });

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection}-book-${bookNumber}.json"`,
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
