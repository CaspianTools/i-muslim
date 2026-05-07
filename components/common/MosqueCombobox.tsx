"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MosqueOption {
  slug: string;
  name: string;
  city?: string;
  country?: string;
}

interface Props {
  value: string | undefined;
  onChange: (slug: string | undefined) => void;
  options: MosqueOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
  /** When true, shows an "x" to clear the selection. Defaults to true. */
  allowClear?: boolean;
}

export function MosqueCombobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  className,
  ariaLabel,
  allowClear = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("mosqueCombobox");

  const selected = value ? options.find((o) => o.slug === value) : undefined;

  function handleSelect(slug: string) {
    onChange(slug);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "truncate text-start",
              !selected && "text-muted-foreground",
            )}
          >
            {selected
              ? selected.city
                ? `${selected.name} — ${selected.city}`
                : selected.name
              : placeholder ?? t("selectMosque")}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {allowClear && selected && !disabled && (
              <span
                role="button"
                aria-label={t("clear")}
                onClick={handleClear}
                className="rounded-sm hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSelected = o.slug === value;
                return (
                  <CommandItem
                    key={o.slug}
                    value={`${o.name} ${o.city ?? ""} ${o.country ?? ""} ${o.slug}`}
                    onSelect={() => handleSelect(o.slug)}
                    className={cn(
                      "px-2 py-2 cursor-pointer",
                      isSelected && "ui-selected",
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.name}</span>
                      {(o.city || o.country) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[o.city, o.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </span>
                    <Check
                      className={cn(
                        "size-4 ml-2 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
