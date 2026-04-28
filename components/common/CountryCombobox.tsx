"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { getCountries, getCountryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface SharedProps {
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  /** ARIA label for the trigger button (when no visible label is wired) */
  ariaLabel?: string;
}

interface SingleProps extends SharedProps {
  multiple?: false;
  value: string;
  onChange: (code: string) => void;
}

interface MultiProps extends SharedProps {
  multiple: true;
  value: string[];
  onChange: (codes: string[]) => void;
}

export type CountryComboboxProps = SingleProps | MultiProps;

const MAX_VISIBLE_CHIPS = 3;

export function CountryCombobox(props: CountryComboboxProps) {
  const { multiple, placeholder, disabled, id, className, ariaLabel } = props;
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const t = useTranslations("countryCombobox");

  const countries = React.useMemo(() => getCountries(locale), [locale]);

  const selectedCodes: string[] = multiple ? props.value : props.value ? [props.value] : [];

  function handleSelect(code: string) {
    if (multiple) {
      const set = new Set(props.value);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      props.onChange(Array.from(set));
    } else {
      props.onChange(code);
      setOpen(false);
    }
  }

  function handleRemoveChip(code: string, e: React.MouseEvent) {
    if (!multiple) return;
    e.preventDefault();
    e.stopPropagation();
    props.onChange(props.value.filter((c) => c !== code));
  }

  const triggerLabel = (() => {
    if (selectedCodes.length === 0) {
      return placeholder ?? (multiple ? t("selectCountries") : t("selectCountry"));
    }
    if (!multiple) return getCountryName(selectedCodes[0]!, locale);
    return null;
  })();

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
          {multiple && selectedCodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 min-w-0 py-0.5">
              {selectedCodes.slice(0, MAX_VISIBLE_CHIPS).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs"
                >
                  <span className="font-mono text-muted-foreground">{code}</span>
                  <span className="truncate max-w-[8rem]">
                    {getCountryName(code, locale)}
                  </span>
                  {!disabled && (
                    <span
                      role="button"
                      aria-label={t("removeChip", { name: getCountryName(code, locale) })}
                      onClick={(e) => handleRemoveChip(code, e)}
                      className="rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3" />
                    </span>
                  )}
                </span>
              ))}
              {selectedCodes.length > MAX_VISIBLE_CHIPS && (
                <span className="text-xs text-muted-foreground">
                  {t("moreCountries", { count: selectedCodes.length - MAX_VISIBLE_CHIPS })}
                </span>
              )}
            </div>
          ) : (
            <span
              className={cn(
                "truncate text-start",
                selectedCodes.length === 0 && "text-muted-foreground",
              )}
            >
              {triggerLabel}
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            <CommandGroup>
              {countries.map((c) => {
                const isSelected = selectedCodes.includes(c.code);
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.name}`}
                    onSelect={() => handleSelect(c.code)}
                    className="px-2 py-2 cursor-pointer"
                  >
                    <span className="font-mono text-muted-foreground w-7 text-center shrink-0 text-xs">
                      {c.code}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
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
