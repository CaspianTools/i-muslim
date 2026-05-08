import {
  getHadithCollection,
  getAdminHadithsByBook,
} from "@/lib/hadith/db";
import {
  buildHadithExport,
  type HadithExportLang,
} from "@/lib/hadith/export";
import { requirePermission } from "@/lib/admin/api";
import { ALL_LANGS, type LangCode } from "@/lib/translations";

export const runtime = "nodejs";

function parseLang(raw: string | null): HadithExportLang {
  if (!raw || raw === "all") return "all";
  if ((ALL_LANGS as readonly string[]).includes(raw)) return raw as LangCode;
  return "all";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ collection: string; book: string }> },
) {
  const auth = await requirePermission("hadith.read");
  if (!auth.ok) return auth.response;

  const { collection, book } = await params;
  const url = new URL(req.url);
  const lang = parseLang(url.searchParams.get("lang"));

  const meta = await getHadithCollection(collection);
  if (!meta) return new Response("Not found", { status: 404 });

  const bookNumber = Number(book);
  if (!Number.isInteger(bookNumber) || bookNumber < 1) {
    return new Response("Not found", { status: 404 });
  }
  const bookMeta = meta.books.find((b) => b.number === bookNumber);
  if (!bookMeta) return new Response("Not found", { status: 404 });

  const hadiths = await getAdminHadithsByBook(collection, bookNumber);
  const payload = buildHadithExport(
    meta,
    hadiths,
    {
      kind: "book",
      book: bookNumber,
      bookName: bookMeta.name,
      count: bookMeta.count,
    },
    { lang },
  );

  const langSuffix = lang === "all" ? "" : `-${lang}`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection}-book-${bookNumber}${langSuffix}.json"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
