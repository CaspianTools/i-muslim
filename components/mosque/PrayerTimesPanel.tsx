import { useTranslations } from "next-intl";
import type { Mosque } from "@/types/mosque";
import { resolveAdhan } from "@/lib/mosques/iqamah";

export function PrayerTimesPanel({ mosque, locale }: { mosque: Mosque; locale: string }) {
  const t = useTranslations("mosques.detail");
  const tPrayer = useTranslations("mosques.prayer");
  const rows = resolveAdhan(mosque, { locale: localeForFormat(locale) });
  // Only surface the Iqamah column when the masjid has actually set times —
  // otherwise it's an empty column of dashes for the bulk of directory mosques.
  const hasIqamah = rows.some((r) => r.iqamahLabel);
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("prayerTimes")}</h2>
        <p className="text-xs text-muted-foreground">
          {hasIqamah ? t("iqamahNote") : t("prayerTimesNote")}
        </p>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 text-start font-medium" />
            <th className="py-2 text-end font-medium">{t("adhan")}</th>
            {hasIqamah && <th className="py-2 text-end font-medium">{t("iqamah")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prayer} className="border-b border-border last:border-b-0">
              <td className="py-2 font-medium text-foreground">{tPrayer(r.prayer)}</td>
              <td className="py-2 text-end tabular-nums text-foreground">{r.adhanLabel ?? t("noTime")}</td>
              {hasIqamah && (
                <td className="py-2 text-end tabular-nums font-medium text-accent">
                  {r.iqamahLabel ?? t("noTime")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function localeForFormat(locale: string): string {
  switch (locale) {
    case "ar":
      return "en-US"; // 24h numerals; Arabic-Indic digits would surprise some users
    case "tr":
      return "tr-TR";
    case "id":
      return "id-ID";
    default:
      return "en-US";
  }
}
