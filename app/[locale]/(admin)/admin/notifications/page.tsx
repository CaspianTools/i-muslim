import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsListClient } from "@/components/admin/NotificationsListClient";
import {
  fetchNotifications,
  filterAccessibleNotifications,
} from "@/lib/admin/data/notifications";
import { getSiteSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications.page");
  return { title: t("title") };
}

export default async function AdminNotificationsPage() {
  const [session, { items, source }] = await Promise.all([
    getSiteSession(),
    fetchNotifications({ limit: 200 }),
  ]);
  const visible = filterAccessibleNotifications(items, session?.permissions ?? []);
  return (
    <NotificationsListClient
      initialItems={visible}
      canPersist={source === "firestore"}
    />
  );
}
