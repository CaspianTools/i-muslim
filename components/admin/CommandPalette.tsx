"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CornerDownLeft, FileText, Landmark, Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV, type NavItem } from "@/lib/admin/nav";
import type { PaletteEntity, PaletteIndex } from "@/lib/admin/search/palette";

const ENTITY_ICON = {
  mosques: Landmark,
  articles: FileText,
} as const;

function flattenNavWithLabels(
  groupLabel: string,
  parentLabel: string | null,
  items: NavItem[],
  resolveLabel: (key: NavItem["labelKey"]) => string,
): Array<{ item: NavItem; label: string; pathLabel: string; parentLabel: string | null }> {
  const out: Array<{ item: NavItem; label: string; pathLabel: string; parentLabel: string | null }> = [];
  for (const item of items) {
    const label = resolveLabel(item.labelKey);
    out.push({
      item,
      label,
      pathLabel: parentLabel ? `${parentLabel} → ${label}` : label,
      parentLabel,
    });
    if (item.children?.length) {
      out.push(
        ...flattenNavWithLabels(groupLabel, label, item.children, resolveLabel),
      );
    }
  }
  return out;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<PaletteEntity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();
  const t = useTranslations("header");
  const tNav = useTranslations("sidebar");

  function ensureIndex() {
    if (entities !== null || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    fetch("/api/admin/search/palette", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: PaletteIndex) => setEntities(data.items))
      .catch((err) => {
        console.warn("[CommandPalette] failed to load index:", err);
        setEntities([]);
      })
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
      });
  }

  function openPalette() {
    setOpen(true);
    ensureIndex();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          if (next) ensureIndex();
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const mosqueItems = entities?.filter((e) => e.group === "mosques") ?? [];
  const articleItems = entities?.filter((e) => e.group === "articles") ?? [];

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="gap-2 text-muted-foreground font-normal w-full justify-start md:w-64"
        onClick={openPalette}
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
          <CommandEmpty>
            {loading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {t("searchLoading")}
              </span>
            ) : (
              t("noResults")
            )}
          </CommandEmpty>
          {ADMIN_NAV.map((group) => {
            const groupLabel = tNav(`groups.${group.id}` as `groups.${typeof group.id}`);
            const flat = flattenNavWithLabels(groupLabel, null, group.items, (key) =>
              tNav(`items.${key}` as `items.${typeof key}`),
            );
            return (
              <CommandGroup key={group.id} heading={groupLabel}>
                {flat.map(({ item, pathLabel }) => (
                  <CommandItem
                    key={item.href}
                    className="group"
                    value={`${pathLabel} ${groupLabel}`}
                    keywords={[item.href, item.href.split("/").pop() ?? ""].filter(Boolean)}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    <span>{pathLabel}</span>
                    <CornerDownLeft className="ml-auto size-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          {mosqueItems.length > 0 && (
            <CommandGroup heading={t("groupMosques")}>
              {mosqueItems.map((entity) => (
                <EntityItem key={`m-${entity.id}`} entity={entity} onSelect={go} />
              ))}
            </CommandGroup>
          )}
          {articleItems.length > 0 && (
            <CommandGroup heading={t("groupArticles")}>
              {articleItems.map((entity) => (
                <EntityItem key={`a-${entity.id}`} entity={entity} onSelect={go} />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function EntityItem({
  entity,
  onSelect,
}: {
  entity: PaletteEntity;
  onSelect: (href: string) => void;
}) {
  const Icon = ENTITY_ICON[entity.group];
  return (
    <CommandItem
      value={`${entity.label} ${entity.hint ?? ""}`.trim()}
      keywords={entity.keywords}
      onSelect={() => onSelect(entity.href)}
    >
      <Icon />
      <span className="truncate">{entity.label}</span>
      {entity.hint && (
        <span className="ml-auto truncate text-xs text-muted-foreground">{entity.hint}</span>
      )}
    </CommandItem>
  );
}
