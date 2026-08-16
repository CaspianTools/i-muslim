import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { DEFAULT_TAFSIR_WORK } from "@/lib/tafsir/works";

// With a single work, a bare /tafsir index would be a thin duplicate of the
// work page. Redirect instead — the same call the repo already makes for /apps
// (see the note in app/sitemap.ts). When a second work lands, this becomes a
// real index and the redirect goes away.
export default async function TafsirIndexPage() {
  const locale = await getLocale();
  redirect({ href: `/tafsir/${DEFAULT_TAFSIR_WORK}`, locale });
}
