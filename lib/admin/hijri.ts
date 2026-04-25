import umalqura from "@umalqura/core";

export interface HijriParts {
  day: number;
  monthIndex: number; // 1..12
  year: number;
}

export function getHijriParts(date: Date = new Date()): HijriParts {
  const h = umalqura(date);
  return { day: h.hd, monthIndex: h.hm, year: h.hy };
}

export function formatGregorian(date: Date = new Date(), locale?: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
