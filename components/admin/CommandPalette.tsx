"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CornerDownLeft, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV } from "@/lib/admin/nav";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("header");
  const tNav = useTranslations("sidebar");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="gap-2 text-muted-foreground font-normal w-full justify-start md:w-64"
        onClick={() => setOpen(true)}
        aria-label={t("openCommandPalette")}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("searchFallback")}</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          {ADMIN_NAV.map((group) => {
            const groupLabel = tNav(`groups.${group.id}` as `groups.${typeof group.id}`);
            return (
              <CommandGroup key={group.id} heading={groupLabel}>
                {group.items.map((item) => {
                  const label = tNav(`items.${item.labelKey}` as `items.${typeof item.labelKey}`);
                  return (
                    <CommandItem
                      key={item.href}
                      value={`${label} ${groupLabel}`}
                      onSelect={() => go(item.href)}
                    >
                      <item.icon />
                      <span>{label}</span>
                      <CornerDownLeft className="ml-auto size-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
