import JSZip from "jszip";
import {
  getHadithCollection,
  getAdminHadithsByCollection,
  type HadithDoc,
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
  { params }: { params: Promise<{ collection: string }> },
) {
  const auth = await requirePermission("hadith.read");
  if (!auth.ok) return auth.response;

  const { collection } = await params;
  const url = new URL(req.url);
  const lang = parseLang(url.searchParams.get("lang"));
  const chunked = url.searchParams.get("chunked") === "1";

  const meta = await getHadithCollection(collection);
  if (!meta) return new Response("Not found", { status: 404 });

  const hadiths = await getAdminHadithsByCollection(collection);
  const langSuffix = lang === "all" ? "" : `-${lang}`;

  if (chunked) {
    const byBook = new Map<number, HadithDoc[]>();
    for (const h of hadiths) {
      const arr = byBook.get(h.book) ?? [];
      arr.push(h);
      byBook.set(h.book, arr);
    }

    const zip = new JSZip();
    for (const bookMeta of meta.books) {
      const bookHadiths = byBook.get(bookMeta.number) ?? [];
      const payload = buildHadithExport(
        meta,
        bookHadiths,
        {
          kind: "book",
          book: bookMeta.number,
          bookName: bookMeta.name,
          count: bookMeta.count,
        },
        { lang },
      );
      zip.file(
        `${collection}-book-${bookMeta.number}${langSuffix}.json`,
        JSON.stringify(payload, null, 2),
      );
    }

    const buf = await zip.generateAsync({ type: "arraybuffer" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${collection}${langSuffix}-by-book.zip"`,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  const payload = buildHadithExport(
    meta,
    hadiths,
    { kind: "collection" },
    { lang },
  );

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection}${langSuffix}.json"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
