import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function ArticlesNotFound() {
  const t = await getTranslations("articles");
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("notFoundBody")}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/articles">{t("backToList")}</Link>
        </Button>
      </div>
    </div>
  );
}
