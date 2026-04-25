import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactMessagesClient } from "@/components/admin/contact/ContactMessagesClient";
import { fetchContactMessages } from "@/lib/admin/data/contact-messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contactAdmin");
  return { title: t("pageTitle") };
}

export default async function AdminContactMessagesPage() {
  const t = await getTranslations("contactAdmin");
  const { messages, source } = await fetchContactMessages();
  const subtitle = source === "firestore" ? t("subtitleLive") : t("subtitleMock");
  return (
    <div>
      <PageHeader title={t("pageTitle")} subtitle={subtitle} />
      <ContactMessagesClient
        initialMessages={messages}
        canPersist={source === "firestore"}
      />
    </div>
  );
}
