import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("businesses");
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("publicEmpty")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("publicEmptyHint")}</p>
      <Link
        href="/businesses"
        className="mt-6 inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        {t("detail.back")}
      </Link>
    </div>
  );
}
