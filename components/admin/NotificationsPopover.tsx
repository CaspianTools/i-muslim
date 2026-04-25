"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck, HandCoins, MessageCircleQuestion, ShieldAlert, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { MOCK_NOTIFICATIONS } from "@/lib/admin/mock/notifications";
import { formatRelative } from "@/lib/utils";
import type { AdminNotification, NotificationType } from "@/types/admin";

const TYPE_ICON: Record<NotificationType, typeof UserPlus> = {
  signup: UserPlus,
  flagged: ShieldAlert,
  donation: HandCoins,
  qa: MessageCircleQuestion,
  system: Zap,
};

export function NotificationsPopover() {
  const [items, setItems] = useState<AdminNotification[]>(MOCK_NOTIFICATIONS);
  const unread = items.filter((n) => !n.read).length;
  const t = useTranslations("notifications");
  const tHeader = useTranslations("header");

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? tHeader("notificationsAria", { count: unread }) : tHeader("noNotifications")}
        >
          <div className="relative">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-foreground">
                {unread}
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3">
          <div className="text-sm font-semibold">{t("title")}</div>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> {t("markAllRead")}
            </button>
          )}
        </div>
        <Separator />
        <Tabs defaultValue="all" className="p-3">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">{t("tabAll")}</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1">
              {t("tabUnread")} {unread > 0 && `(${unread})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-3">
            <NotificationList items={items} onMark={markOne} emptyLabel={t("empty")} />
          </TabsContent>
          <TabsContent value="unread" className="mt-3">
            <NotificationList items={items.filter((n) => !n.read)} onMark={markOne} emptyLabel={t("empty")} />
          </TabsContent>
        </Tabs>
        <Separator />
        <div className="p-3 text-center">
          <Link
            href="/admin/activity"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  items,
  onMark,
  emptyLabel,
}: {
  items: AdminNotification[];
  onMark: (id: string) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <div className="py-8 text-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <ul className="max-h-80 space-y-1 overflow-y-auto">
      {items.map((n) => {
        const Icon = TYPE_ICON[n.type];
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onMark(n.id)}
              className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-muted"
            >
              <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted">
                <Icon className="size-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{n.title}</span>
                  {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                <span className="text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
