"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getHijriParts, formatGregorian } from "@/lib/admin/hijri";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const noopSubscribe = () => () => {};
const getMounted = () => true;
const getMountedServer = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getMounted, getMountedServer);
}

export function HijriDate() {
  const mounted = useMounted();
  const t = useTranslations("hijri.months");
  const locale = useLocale();

  if (!mounted) return <span className="text-sm text-muted-foreground">—</span>;

  const today = new Date();
  const { day, monthIndex, year } = getHijriParts(today);
  const monthName = t(String(monthIndex) as "1");
  const hijri = `${day} ${monthName} ${year}`;
  const gregorian = formatGregorian(today, locale);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-sm text-muted-foreground" aria-label={`${hijri} (${gregorian})`}>
            {hijri}
          </span>
        </TooltipTrigger>
        <TooltipContent>{gregorian}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
