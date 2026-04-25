"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { CURRENCIES, findCurrency } from "@/lib/zakat/currencies";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export function CurrencyCombobox({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("zakat");
  const selected = findCurrency(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-muted-foreground w-5 text-center shrink-0">
              {selected.symbol}
            </span>
            <span className="font-semibold tabular-nums truncate">{selected.code}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t("currencySearchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("currencyEmpty")}</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map((curr) => {
                const name = t(`currencies.${curr.code}`);
                return (
                  <CommandItem
                    key={curr.code}
                    value={`${curr.code} ${name}`}
                    onSelect={() => {
                      onChange(curr.code);
                      setOpen(false);
                    }}
                    className="px-2 py-2 cursor-pointer"
                  >
                    <span className="font-mono text-muted-foreground w-5 text-center shrink-0">
                      {curr.symbol}
                    </span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-semibold tabular-nums">{curr.code}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {name}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "size-4 ml-2 shrink-0",
                        curr.code === value ? "opacity-100" : "opacity-0",
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
