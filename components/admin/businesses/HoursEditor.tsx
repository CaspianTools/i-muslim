"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_HOURS_DAYS, type BusinessHours, type BusinessHoursDay } from "@/types/business";

interface Props {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
}

export function HoursEditor({ value, onChange }: Props) {
  const t = useTranslations("businesses.weekdays");
  const tAdmin = useTranslations("businesses.admin");

  function setDay(day: BusinessHoursDay, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    const next: BusinessHours = { ...value };
    if (patch.closed) {
      next[day] = null;
    } else {
      const existing = value[day] ?? { open: "09:00", close: "18:00" };
      next[day] = {
        open: patch.open ?? existing.open,
        close: patch.close ?? existing.close,
      };
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {BUSINESS_HOURS_DAYS.map((day) => {
        const entry = value[day];
        const isClosed = entry === null;
        return (
          <div key={day} className="grid grid-cols-[88px_auto_1fr_1fr] items-center gap-2">
            <Label className="text-sm">{t(day)}</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={!isClosed}
                onChange={(e) => setDay(day, { closed: !e.target.checked })}
              />
              <span>{isClosed ? tAdmin("hoursClosed") : tAdmin("hoursOpen")}</span>
            </label>
            <Input
              type="time"
              disabled={isClosed}
              value={entry?.open ?? ""}
              onChange={(e) => setDay(day, { open: e.target.value })}
              aria-label={tAdmin("hoursOpenAria", { day: t(day) })}
            />
            <Input
              type="time"
              disabled={isClosed}
              value={entry?.close ?? ""}
              onChange={(e) => setDay(day, { close: e.target.value })}
              aria-label={tAdmin("hoursCloseAria", { day: t(day) })}
            />
          </div>
        );
      })}
    </div>
  );
}
