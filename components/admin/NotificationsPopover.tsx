"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatRelative } from "@/lib/utils";
import { NotificationTypeIcon } from "@/components/admin/notifications/type-icon";
import type { AdminNotification } from "@/types/admin";

const POLL_INTERVAL_MS = 60_000;

interface NotificationsPopoverProps {
  initialItems: AdminNotification[];
}

export function NotificationsPopover({ initialItems }: NotificationsPopoverProps) {
  const [items, setItems] = useState<AdminNotification[]>(initialItems);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;
  const t = useTranslations("notifications");
  const tHeader = useTranslations("header");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: AdminNotification[] };
      if (Array.isArray(data.items)) setItems(data.items);
    } catch {
      // ignore — keep current state
    }
  }, []);

  // Poll while the tab is visible.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    function start() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    }
    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Refetch each time the popover opens. Driven from `onOpenChange` rather
  // than a `useEffect(open)` so we don't sync-setState inside an effect (the
  // refresh path goes setItems → re-render via the unrelated `items` state,
  // which the React 19 lint rule flags as a cascading render).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) refresh();
    },
    [refresh],
  );

  async function markOne(id: string) {
    const prev = items;
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) setItems(prev);
    } catch {
      setItems(prev);
    }
  }

  async function markAllRead() {
    const prev = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/admin/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) setItems(prev);
    } catch {
      setItems(prev);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            href="/admin/notifications"
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
      {items.map((n) => (
        <li key={n.id}>
          <NotificationRow item={n} onMark={onMark} />
        </li>
      ))}
    </ul>
  );
}

function NotificationRow({
  item,
  onMark,
}: {
  item: AdminNotification;
  onMark: (id: string) => void;
}) {
  const inner = (
    <>
      <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted">
        <NotificationTypeIcon type={item.type} className="size-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
        <span className="text-[11px] text-muted-foreground">{formatRelative(item.createdAt)}</span>
      </div>
    </>
  );

  if (item.link) {
    return (
      <Link
        href={item.link}
        onClick={() => onMark(item.id)}
        className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-muted"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onMark(item.id)}
      className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-muted"
    >
      {inner}
    </button>
  );
}
