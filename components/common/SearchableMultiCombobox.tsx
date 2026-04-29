"use client";

import * as React from "react";
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

export type SearchableMultiComboboxOption = {
  value: string;
  label: string;
  secondary?: string;
};

export interface SearchableMultiComboboxProps {
  options: SearchableMultiComboboxOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  removeChipLabel?: (label: string) => string;
  moreText?: (count: number) => string;
  maxVisibleChips?: number;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
  /** Width of the popover. Defaults to "w-72". */
  popoverClassName?: string;
}

export function SearchableMultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  removeChipLabel,
  moreText,
  maxVisibleChips = 3,
  disabled,
  ariaLabel,
  id,
  className,
  popoverClassName,
}: SearchableMultiComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const labelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) map.set(o.value, o.label);
    return map;
  }, [options]);

  function handleSelect(v: string) {
    const set = new Set(value);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange(Array.from(set));
  }

  function handleRemoveChip(v: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter((x) => x !== v));
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
          {value.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 min-w-0 py-0.5">
              {value.slice(0, maxVisibleChips).map((v) => {
                const label = labelByValue.get(v) ?? v;
                return (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs"
                  >
                    <span className="truncate max-w-[8rem]">{label}</span>
                    {!disabled && (
                      <span
                        role="button"
                        aria-label={removeChipLabel ? removeChipLabel(label) : `Remove ${label}`}
                        onClick={(e) => handleRemoveChip(v, e)}
                        className="rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="size-3" />
                      </span>
                    )}
                  </span>
                );
              })}
              {value.length > maxVisibleChips && (
                <span className="text-xs text-muted-foreground">
                  {moreText
                    ? moreText(value.length - maxVisibleChips)
                    : `+${value.length - maxVisibleChips} more`}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate text-start text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-72 p-0", popoverClassName)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSelected = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.secondary ?? ""}`}
                    onSelect={() => handleSelect(o.value)}
                    className="px-2 py-2 cursor-pointer"
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.secondary && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {o.secondary}
                      </span>
                    )}
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
