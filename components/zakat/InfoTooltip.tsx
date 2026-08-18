"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTooltip({ content }: { content: string }) {
  const t = useTranslations("zakat");
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("moreInfo")}
          >
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
