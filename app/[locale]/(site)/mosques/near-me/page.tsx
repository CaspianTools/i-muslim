import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NearMeClient } from "@/components/mosque/NearMeClient";

export const metadata: Metadata = { title: "Mosques near me" };

export default async function NearMePage() {
  const t = await getTranslations("mosques.nearMe");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <NearMeClient />
    </div>
  );
}
