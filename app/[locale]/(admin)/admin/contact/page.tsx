import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactMessagesClient } from "@/components/admin/contact/ContactMessagesClient";
import { fetchContactMessages } from "@/lib/admin/data/contact-messages";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contactAdmin");
  return { title: t("pageTitle") };
}

export default async function AdminContactMessagesPage() {
  // The sidebar already hides this for roles lacking `contact.read`, but that's
  // cosmetic — gate the page itself so a direct URL (or a stale notification
  // link) can't load the inbox. No admin error boundary exists, so redirect.
  const session = await getSiteSession();
  const locale = await getLocale();
  if (!session || !hasPermission(session.permissions, "contact.read")) {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations("contactAdmin");
  const { messages, source } = await fetchContactMessages();
  return (
    <div>
      <PageHeader title={t("pageTitle")} />
      <ContactMessagesClient
        initialMessages={messages}
        canPersist={source === "firestore"}
      />
    </div>
  );
}
